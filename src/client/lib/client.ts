import {
  BoxCipher,
  Cipher,
  cipherParser,
  generateBoxCipher,
  SealedBoxCipher,
  SecretBoxCipher,
} from './ciphers'
import { decrypt, encodedCiphertextFormatV1, encrypt } from './encryption'
import {
  generateSignatureKeyPair,
  signHash,
  verifySignedHash,
} from './signHash'
import type { Sodium } from './sodium'
import { checkEncryptionPublicKey, checkSignaturePublicKey } from './utils'

export type ClientConfig<KeyType = string> = {
  serverURL: string
  serverPublicKey: KeyType
  pollingInterval?: number
  onKeyReceived?: (key: KeychainItem) => unknown
}

type Config = Omit<ClientConfig<Key>, 'pollingInterval'> &
  Required<Pick<ClientConfig<Key>, 'pollingInterval'>>

// --

type Key = Uint8Array

type KeyPair = {
  publicKey: Key
  privateKey: Key
}

// --

type KeychainItem<CipherType = Cipher> = {
  name: string
  cipher: CipherType
  createdAt: number
  expiresAt?: number
}

type Keychain = Map<string, KeychainItem>

type ServerKeychainItem = KeychainItem<string> & {
  id: string
}

type ServerKeychain = Array<ServerKeychainItem>

// --

type Identity = {
  userID: string
  signature: KeyPair
  sharing: KeyPair
}

type PartialIdentity = Pick<Identity, 'userID'> &
  Partial<Omit<Identity, 'userID'>>

type PublicUserIdentity<KeyType = Key> = {
  userID: string
  signaturePublicKey: KeyType
  sharingPublicKey: KeyType
}

// --

type Message = {
  from: PublicUserIdentity<string>
  to: PublicUserIdentity<string>
  name: string
  payload: string
  nameFingerprint: string
  payloadFingerprint: string
  expiresAt?: number
  signature: string
}

type IncomingMessage = Message & {
  id: string
  createdAt: number
}

// --

type IdleState = {
  state: 'idle'
}

type LoadedState = {
  state: 'loaded'
  identity: Identity
  personalKey: Key
  keychain: Keychain
  messagePollingHandle: undefined | ReturnType<typeof setInterval>
}

type State = IdleState | LoadedState

// --

type HTTPMethod = 'GET' | 'POST' | 'DELETE'

// --

const DEFAULT_POLLING_INTERVAL = 30_000 // 30 seconds

export class Client {
  public readonly sodium: Sodium
  public readonly config: Readonly<Config>
  #state: State

  constructor(sodium: Sodium, config: ClientConfig) {
    this.sodium = sodium
    this.config = Object.freeze({
      serverURL: config.serverURL,
      serverPublicKey: this.decode(config.serverPublicKey),
      onKeyReceived: config.onKeyReceived,
      pollingInterval: config.pollingInterval ?? DEFAULT_POLLING_INTERVAL,
    })
    this.#state = {
      state: 'idle',
    }
  }

  // Auth --

  public async signup(userID: string, personalKey: Uint8Array) {
    const sharing = generateBoxCipher(this.sodium)
    const identity: Identity = {
      userID,
      signature: generateSignatureKeyPair(this.sodium),
      sharing: {
        publicKey: sharing.publicKey,
        privateKey: sharing.privateKey,
      },
    }
    const withPersonalKey: SecretBoxCipher = {
      algorithm: 'secretBox',
      key: personalKey,
    }
    // todo: Provide a type for signup body
    const body = {
      userID,
      signaturePublicKey: this.encode(identity.signature.publicKey),
      sharingPublicKey: this.encode(identity.sharing.publicKey),
      signaturePrivateKey: encrypt(
        this.sodium,
        identity.signature.privateKey,
        withPersonalKey,
        'base64'
      ),
      sharingPrivateKey: encrypt(
        this.sodium,
        identity.sharing.privateKey,
        withPersonalKey,
        'base64'
      ),
    }
    this.#state = {
      state: 'loaded',
      identity,
      personalKey,
      keychain: new Map(),
      messagePollingHandle: undefined,
    }
    try {
      await this.apiCall('POST', '/signup', body)
      this.#state.messagePollingHandle = this.startMessagePolling()
      return this.publicIdentity
    } catch (error) {
      this.logout() // Cleanup on failure
      throw error
    }
  }

  public async login(userID: string, personalKey: Uint8Array) {
    const res = await fetch(`${this.config.serverURL}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userID,
      }),
    })
    // todo: Use a parser
    type ResponseBody = {
      userID: string
      signaturePublicKey: string
      sharingPublicKey: string
      signaturePrivateKey: string
      sharingPrivateKey: string
    }
    const responseBody = await this.verifyServerResponse<ResponseBody>(
      'POST',
      res,
      { userID }
    )
    const withPersonalKey: SecretBoxCipher = {
      algorithm: 'secretBox',
      key: personalKey,
    }
    const identity: Identity = {
      userID,
      signature: {
        publicKey: this.decode(responseBody.signaturePublicKey),
        privateKey: decrypt(
          this.sodium,
          responseBody.signaturePrivateKey,
          withPersonalKey,
          'base64'
        ),
      },
      sharing: {
        publicKey: this.decode(responseBody.sharingPublicKey),
        privateKey: decrypt(
          this.sodium,
          responseBody.sharingPrivateKey,
          withPersonalKey,
          'base64'
        ),
      },
    }
    if (
      !checkSignaturePublicKey(
        this.sodium,
        identity.signature.publicKey,
        identity.signature.privateKey
      )
    ) {
      throw new Error('Invalid signature key pair')
    }
    if (
      !checkEncryptionPublicKey(
        this.sodium,
        identity.sharing.publicKey,
        identity.sharing.privateKey
      )
    ) {
      throw new Error('Invalid sharing key pair')
    }
    const keychain = await this.loadKeychain()
    this.#state = {
      state: 'loaded',
      identity,
      personalKey,
      keychain,
      messagePollingHandle: this.startMessagePolling(),
    }
    return this.publicIdentity
  }

  public logout() {
    if (this.#state.state === 'loaded') {
      clearTimeout(this.#state.messagePollingHandle)
      this.sodium.memzero(this.#state.personalKey)
      this.sodium.memzero(this.#state.identity.sharing.privateKey)
      this.sodium.memzero(this.#state.identity.signature.privateKey)
      this.#state.keychain.forEach(item => this.memzeroCipher(item.cipher))
      this.#state.keychain.clear()
    }
    this.#state = {
      state: 'idle',
    }
  }

  // Key Ops --

  public async addKey({
    name,
    cipher,
    expiresAt,
    createdAt = Date.now(),
  }: Omit<KeychainItem, 'createdAt'> &
    Partial<Pick<KeychainItem, 'createdAt'>>) {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account is locked')
    }
    const withPersonalKey = this.usePersonalKey()
    const body: KeychainItem<string> = {
      createdAt,
      expiresAt,
      name: encrypt(
        this.sodium,
        name,
        withPersonalKey,
        encodedCiphertextFormatV1
      ),
      cipher: encrypt(
        this.sodium,
        this.serializeCipher(cipher),
        withPersonalKey,
        encodedCiphertextFormatV1
      ),
    }
    await this.apiCall('POST', '/keys', body)
    this.#state.keychain.set(name, {
      name,
      cipher,
      createdAt,
      expiresAt,
    })
  }

  public getKeyByName(name: string) {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account must be unlocked before accessing keys')
    }
    return this.#state.keychain.get(name)?.cipher
  }

  // Sharing --

  public async sendKey(
    { cipher, name, expiresAt }: KeychainItem,
    to: PublicUserIdentity
  ) {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account must be unlocked before sending keys')
    }
    const sendTo: BoxCipher = {
      algorithm: 'box',
      privateKey: this.#state.identity.sharing.privateKey,
      publicKey: to.sharingPublicKey,
    }
    const payload = this.serializeCipher(cipher)
    const body: Message = {
      from: this.encodeIdentity(this.publicIdentity),
      to: this.encodeIdentity(to),
      name: encrypt(this.sodium, name, sendTo, encodedCiphertextFormatV1),
      payload,
      payloadFingerprint: this.sodium.crypto_hash(payload, 'hex'),
      nameFingerprint: this.sodium.crypto_hash(name, 'hex'),
      expiresAt,
      signature: this.encode(
        signHash(
          this.sodium,
          this.#state.identity.signature.privateKey,
          this.sodium.from_string(name),
          this.sodium.from_string(payload)
        )
      ),
    }
    return this.apiCall('POST', '/share', body)
  }

  // User Ops --

  public get publicIdentity(): PublicUserIdentity {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account is locked')
    }
    return {
      userID: this.#state.identity.userID,
      sharingPublicKey: this.#state.identity.sharing.publicKey,
      signaturePublicKey: this.#state.identity.signature.publicKey,
    }
  }

  public async getUserIdentity(
    userID: string
  ): Promise<PublicUserIdentity | null> {
    type Response = PublicUserIdentity<string> | null
    const res = await this.apiCall<Response>('GET', `/user/${userID}`)
    if (!res) {
      return null
    }
    if (res.userID !== userID) {
      throw new Error('Mismatching user IDs')
    }
    return this.decodeIdentity(res)
  }

  public async getUsersIdentities(
    userIDs: string[]
  ): Promise<PublicUserIdentity[]> {
    const res = await this.apiCall<PublicUserIdentity<string>[]>(
      'GET',
      `/users/${userIDs.join(',')}`
    )
    return res.map(identity => this.decodeIdentity(identity))
  }

  // Helpers --

  public encode(input: Uint8Array) {
    return this.sodium.to_base64(input)
  }

  public decode(input: string) {
    return this.sodium.from_base64(input)
  }

  // Internal APIs --

  private async loadKeychain(): Promise<Keychain> {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account must be unlocked before calling API')
    }
    const keychain: Keychain = new Map()
    const res = await this.apiCall<ServerKeychain>('GET', '/keys')
    const withPersonalKey = this.usePersonalKey()
    for (const lockedItem of res) {
      // todo: Error handling
      // todo: Detect tampering
      const item: KeychainItem = {
        name: decrypt(
          this.sodium,
          lockedItem.name,
          withPersonalKey,
          encodedCiphertextFormatV1
        ),
        cipher: cipherParser.parse(
          decrypt(
            this.sodium,
            lockedItem.cipher,
            withPersonalKey,
            encodedCiphertextFormatV1
          )
        ),
        createdAt: lockedItem.createdAt,
        expiresAt: lockedItem.expiresAt,
      }
      keychain.set(item.name, item)
    }
    return keychain
  }

  private async processIncomingMessages() {
    if (this.#state.state !== 'loaded') {
      console.error('Account must be unlocked before receiving keys')
      return
    }
    let messages: IncomingMessage[] = []
    try {
      messages = await this.apiCall<IncomingMessage[]>('GET', '/share')
    } catch (error) {
      console.error(error)
    }
    for (const message of messages) {
      try {
        const sender = this.decodeIdentity(message.from)
        const withSharedSecret: BoxCipher = {
          algorithm: 'box',
          privateKey: this.#state.identity.sharing.privateKey,
          publicKey: sender.sharingPublicKey,
        }
        const item: KeychainItem = {
          name: decrypt(
            this.sodium,
            message.name,
            withSharedSecret,
            encodedCiphertextFormatV1
          ),
          cipher: cipherParser.parse(
            decrypt(
              this.sodium,
              message.payload,
              withSharedSecret,
              encodedCiphertextFormatV1
            )
          ),
          createdAt: message.createdAt,
          expiresAt: message.expiresAt,
        }
        // todo: Verify signature
        // if (
        //   !verifySignedHash(
        //     this.sodium,
        //     this.decode(message.from.signaturePublicKey),
        //     this.decode(message.signature),
        //     this.sodium.from_string(item.name),
        //     item.key
        //   )
        // ) {
        //   continue
        // }
        // todo: Verify fingerprints
        // const keyFingerprint = this.sodium.crypto_hash(item.key, 'hex')
        // const nameFingerprint = this.sodium.crypto_hash(item.name, 'hex')
        // if (
        //   keyFingerprint !== message.keyFingerprint ||
        //   nameFingerprint !== message.nameFingerprint
        // ) {
        //   continue
        // }
        // if (this.#state.keychain.has(item.name)) {
        //   continue
        // }
        await this.addKey(item)
        await this.apiCall('DELETE', `/share/${message.id}`)
        await this.config.onKeyReceived?.(item)
      } catch (error) {
        console.error(error)
        continue
      }
    }
  }

  private startMessagePolling() {
    this.processIncomingMessages().catch(console.error)
    return setInterval(
      this.processIncomingMessages.bind(this),
      this.config.pollingInterval
    )
  }

  // API Layer --

  private async apiCall<ResponseType>(
    method: 'GET' | 'DELETE',
    path: string
  ): Promise<ResponseType>

  private async apiCall<BodyType, ReponseType>(
    method: 'POST',
    path: string,
    body: BodyType
  ): Promise<ResponseType>

  private async apiCall<BodyType, ResponseType>(
    method: HTTPMethod,
    path: string,
    body?: BodyType
  ): Promise<ResponseType> {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account must be loaded before calling API')
    }
    const url = `${this.config.serverURL}${path}`
    const json = body ? JSON.stringify(body) : undefined
    const timestamp = Date.now().toFixed()
    const signature = signHash(
      this.sodium,
      this.#state.identity.signature.privateKey,
      ...getSignatureParts(
        this.sodium,
        method,
        url,
        timestamp,
        json,
        this.#state.identity
      )
    )
    const res = await fetch(`${this.config.serverURL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-e2esdk-user-id': this.#state.identity.userID,
        'x-e2esdk-timestamp': timestamp,
        'x-e2esdk-signature': this.encode(signature),
      },
      body: json,
    })
    return this.verifyServerResponse<ResponseType>(
      method,
      res,
      this.#state.identity
    )
  }

  private async verifyServerResponse<Output>(
    method: HTTPMethod,
    res: Response,
    identity: PartialIdentity
  ): Promise<Output> {
    const now = Date.now()
    const signatureHeader = res.headers.get('x-e2esdk-signature')
    if (!signatureHeader) {
      throw new Error('Missing server response signature')
    }
    const timestampHeader = res.headers.get('x-e2esdk-timestamp')
    if (!timestampHeader) {
      throw new Error('Missing server response timestamp')
    }
    const signature = this.decode(signatureHeader)
    // res.text() will return "" on empty bodies
    const json = (await res.text()) || undefined
    const verified = verifySignedHash(
      this.sodium,
      this.config.serverPublicKey,
      signature,
      ...getSignatureParts(
        this.sodium,
        method,
        res.url,
        timestampHeader,
        json,
        identity
      )
    )
    if (!verified) {
      throw new Error('Invalid server response signature')
    }
    if (Math.abs(parseInt(timestampHeader) - now) > 15 * 60 * 1000) {
      throw new Error(
        'Invalid server response timestamp (outside of +/- 15 minutes interval)'
      )
    }
    return json ? JSON.parse(json) : undefined
  }

  // --

  private usePersonalKey(): SecretBoxCipher {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account is locked')
    }
    return {
      algorithm: 'secretBox',
      key: this.#state.personalKey,
    }
  }

  private serializeCipher(cipher: Cipher) {
    // todo: Pad output to hide cipher type
    if (cipher.algorithm === 'box') {
      // todo: Does this make sense?
      const payload: Omit<BoxCipher<string>, 'nonce'> = {
        algorithm: cipher.algorithm,
        publicKey: this.encode(cipher.publicKey),
        privateKey: this.encode(cipher.privateKey),
      }
      return JSON.stringify(payload)
    }
    if (cipher.algorithm === 'sealedBox') {
      if (!cipher.privateKey) {
        throw new Error('Missing private key in sealedBox cipher')
      }
      const payload: SealedBoxCipher<string> = {
        algorithm: cipher.algorithm,
        publicKey: this.encode(cipher.publicKey),
        privateKey: this.encode(cipher.privateKey),
      }
      return JSON.stringify(payload)
    }
    if (cipher.algorithm === 'secretBox') {
      const payload: Omit<SecretBoxCipher<string>, 'nonce'> = {
        algorithm: cipher.algorithm,
        key: this.encode(cipher.key),
      }
      return JSON.stringify(payload)
    }
    throw new Error('Unsupported cipher algorithm')
  }

  private memzeroCipher(cipher: Cipher) {
    if (cipher.algorithm === 'box') {
      this.sodium.memzero(cipher.privateKey)
      if (cipher.nonce) {
        this.sodium.memzero(cipher.nonce)
      }
    }
    if (cipher.algorithm === 'sealedBox' && cipher.privateKey) {
      this.sodium.memzero(cipher.privateKey)
    }
    if (cipher.algorithm === 'secretBox') {
      this.sodium.memzero(cipher.key)
      if (cipher.nonce) {
        this.sodium.memzero(cipher.nonce)
      }
    }
    throw new Error('Unsupported cipher algorithm')
  }

  private encodeIdentity(
    identity: PublicUserIdentity<Key>
  ): PublicUserIdentity<string> {
    return {
      userID: identity.userID,
      sharingPublicKey: this.encode(identity.sharingPublicKey),
      signaturePublicKey: this.encode(identity.signaturePublicKey),
    }
  }

  private decodeIdentity(
    identity: PublicUserIdentity<string>
  ): PublicUserIdentity<Key> {
    return {
      userID: identity.userID,
      sharingPublicKey: this.decode(identity.sharingPublicKey),
      signaturePublicKey: this.decode(identity.signaturePublicKey),
    }
  }
}

function getSignatureParts(
  sodium: Sodium,
  method: HTTPMethod,
  url: string,
  timestamp: string,
  body: string | undefined,
  identity: PartialIdentity
) {
  return [
    sodium.from_string(identity.userID),
    sodium.from_string(`${method} ${url}`),
    sodium.from_string(timestamp),
    body ? sodium.from_string(body) : null,
    identity.signature ? identity.signature.publicKey : null,
  ].filter(Boolean) as Uint8Array[]
}

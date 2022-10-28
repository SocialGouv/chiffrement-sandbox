import b64 from '@47ng/codec/dist/b64'
import type { SignupRequestBody } from '../api/signup.js'
import type { Optional } from '../types.js'
import {
  sign as signClientRequest,
  verify as verifyServerSignature,
} from './auth.js'
import {
  BoxCipher,
  Cipher,
  cipherParser,
  generateBoxCipher,
  SealedBoxCipher,
  SecretBoxCipher,
} from './ciphers.js'
import { decrypt, encodedCiphertextFormatV1, encrypt } from './encryption.js'
import { generateSignatureKeyPair, signHash } from './signHash.js'
import type { Sodium } from './sodium.js'
import { checkEncryptionPublicKey, checkSignaturePublicKey } from './utils.js'

export type ClientConfig<KeyType = string> = {
  serverURL: string
  serverPublicKey: KeyType // todo: Make this an array to allow server key rotation
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
  userId: string
  signature: KeyPair
  sharing: KeyPair
}

type PartialIdentity = Optional<Identity, 'sharing' | 'signature'>

export type PublicUserIdentity<KeyType = Key> = {
  userId: string
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

  public async signup(userId: string, personalKey: Uint8Array) {
    await this.sodium.ready
    const sharing = generateBoxCipher(this.sodium)
    const identity: Identity = {
      userId,
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
    const body: SignupRequestBody = {
      userId,
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

  public async login(userId: string, personalKey: Uint8Array) {
    await this.sodium.ready
    const res = await fetch(`${this.config.serverURL}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    })
    // todo: Error handling
    // todo: Use a parser
    type ResponseBody = {
      userId: string
      signaturePublicKey: string
      sharingPublicKey: string
      signaturePrivateKey: string
      sharingPrivateKey: string
    }
    const responseBody = await this.verifyServerResponse<ResponseBody>(
      'POST',
      res,
      { userId }
    )
    const withPersonalKey: SecretBoxCipher = {
      algorithm: 'secretBox',
      key: personalKey,
    }
    const identity: Identity = {
      userId,
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
    await this.sodium.ready
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
    await this.sodium.ready
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
      userId: this.#state.identity.userId,
      sharingPublicKey: this.#state.identity.sharing.publicKey,
      signaturePublicKey: this.#state.identity.signature.publicKey,
    }
  }

  public async getuserIdentity(
    userId: string
  ): Promise<PublicUserIdentity | null> {
    await this.sodium.ready
    type Response = PublicUserIdentity<string> | null
    const res = await this.apiCall<Response>('GET', `/user/${userId}`)
    if (!res) {
      return null
    }
    if (res.userId !== userId) {
      throw new Error('Mismatching user IDs')
    }
    return this.decodeIdentity(res)
  }

  public async getUsersIdentities(
    userIds: string[]
  ): Promise<PublicUserIdentity[]> {
    await this.sodium.ready
    const res = await this.apiCall<PublicUserIdentity<string>[]>(
      'GET',
      `/users/${userIds.join(',')}`
    )
    return res.map(identity => this.decodeIdentity(identity))
  }

  // Helpers --
  // We're not using the sodium conversions because those need it
  // to be ready, and we want to be able to encode/decode at any time.

  public encode(input: Uint8Array) {
    return b64.encode(input).replace(/={1,2}$/, '')
  }

  public decode(input: string) {
    return b64.decode(input)
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
    const signature = signClientRequest(
      this.sodium,
      this.#state.identity.signature.privateKey,
      {
        timestamp,
        method,
        url,
        body: json,
        serverPublicKey: this.config.serverPublicKey,
        clientPublicKey: this.#state.identity.signature.publicKey,
        userId: this.#state.identity.userId,
      }
    )
    const res = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-e2esdk-user-id': this.#state.identity.userId,
        'x-e2esdk-timestamp': timestamp,
        'x-e2esdk-signature': signature,
      },
      body: json,
    })
    if (!res.ok) {
      // todo: Better error handling
      throw new Error(res.statusText)
    }
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
    const signature = res.headers.get('x-e2esdk-signature')
    if (!signature) {
      throw new Error('Missing server response signature')
    }
    const timestamp = res.headers.get('x-e2esdk-timestamp')
    if (!timestamp) {
      throw new Error('Missing server response timestamp')
    }
    const userId = res.headers.get('x-e2esdk-user-id') ?? undefined
    // res.text() will return "" on empty bodies
    const body = (await res.text()) || undefined
    const verified = verifyServerSignature(
      this.sodium,
      this.config.serverPublicKey,
      signature,
      {
        timestamp,
        method,
        url: res.url,
        body,
        serverPublicKey: this.config.serverPublicKey,
        clientPublicKey: identity.signature?.publicKey,
        userId,
      }
    )
    if (!verified) {
      throw new Error('Invalid server response signature')
    }
    if (userId && userId !== identity.userId) {
      throw new Error('Mismatching user ID')
    }
    if (Math.abs(parseInt(timestamp) - now) > 15 * 60 * 1000) {
      throw new Error(
        'Invalid server response timestamp (outside of +/- 15 minutes interval)'
      )
    }
    return body ? JSON.parse(body) : undefined
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
      userId: identity.userId,
      sharingPublicKey: this.encode(identity.sharingPublicKey),
      signaturePublicKey: this.encode(identity.signaturePublicKey),
    }
  }

  private decodeIdentity(
    identity: PublicUserIdentity<string>
  ): PublicUserIdentity<Key> {
    return {
      userId: identity.userId,
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
  const signatureParts = [
    sodium.from_string(identity.userId),
    sodium.from_string(`${method} ${url}`),
    sodium.from_string(timestamp),
    body ? sodium.from_string(body) : null,
    identity.signature ? identity.signature.publicKey : null,
  ].filter(Boolean) as Uint8Array[]
  console.dir({ signatureParts: signatureParts.map(x => sodium.to_base64(x)) })
  return signatureParts
}

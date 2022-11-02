import mitt, { Emitter } from 'mitt'
import type {
  GetKeychainResponseBody,
  PostKeychainItemRequestBody,
} from '../api/keychain.js'
import { loginResponseBody } from '../api/login.js'
import {
  GetSharedKeysResponseBody,
  PostSharedKeyBody,
} from '../api/sharedKey.js'
import type { SignupRequestBody } from '../api/signup.js'
import { isFarFromCurrentTime } from '../time.js'
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
  memzeroCipher,
  SecretBoxCipher,
  _serializeCipher,
} from './ciphers.js'
import { base64UrlDecode, base64UrlEncode } from './codec.js'
import { decrypt, encodedCiphertextFormatV1, encrypt } from './encryption.js'
import { fingerprint } from './hash.js'
import {
  generateSignatureKeyPair,
  signHash,
  verifySignedHash,
} from './signHash.js'
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

type KeychainItem = {
  name: string
  cipher: Cipher
  createdAt: Date
  expiresAt: Date | null
  sharedBy: string | null
}

type Keychain = Map<string, KeychainItem>

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

type Events = {
  identityUpdated: PublicUserIdentity | null
}

// --

type HTTPMethod = 'GET' | 'POST' | 'DELETE'

// --

const DEFAULT_POLLING_INTERVAL = 30_000 // 30 seconds

export class Client {
  public readonly sodium: Sodium
  public readonly config: Readonly<Config>
  #state: State
  #mitt: Emitter<Events>

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
    this.#mitt = mitt()
  }

  // Event Emitter --

  public on<K extends keyof Events>(
    event: K,
    callback: (arg: Events[K]) => void
  ) {
    this.#mitt.on(event, callback)
    return () => this.#mitt.off(event, callback)
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
      this.#mitt.emit('identityUpdated', this.publicIdentity)
      return this.publicIdentity
    } catch (error) {
      this.logout() // Cleanup on failure
      throw error
    }
  }

  public async login(userId: string, personalKey: Uint8Array) {
    await this.sodium.ready
    const res = await fetch(`${this.config.serverURL}/login`, {
      headers: {
        'content-type': 'application/json',
        'x-e2esdk-user-id': userId,
        'x-e2esdk-timestamp': new Date().toISOString(),
      },
    })
    // todo: Error handling
    // todo: Verify server response AFTER parsing body (requires refactor)
    const responseBody = loginResponseBody.parse(await res.json())
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
    this.#state = {
      state: 'loaded',
      identity,
      personalKey,
      keychain: new Map(),
      messagePollingHandle: this.startMessagePolling(),
    }
    // Load keychain & incoming shared keys in the background
    this.loadKeychain().catch(console.error)
    this.processIncomingSharedKeys().catch(console.error)
    this.#mitt.emit('identityUpdated', this.publicIdentity)
    return this.publicIdentity
  }

  public logout() {
    this.clearState()
  }

  // Key Ops --

  public async addKey({
    name,
    cipher,
    createdAt = new Date(),
    expiresAt = null,
    sharedBy = null,
  }: Optional<KeychainItem, 'createdAt'>) {
    await this.sodium.ready
    if (this.#state.state !== 'loaded') {
      throw new Error('Account is locked')
    }
    const serializedCipher = _serializeCipher(this.sodium, cipher)
    if (this.#state.keychain.has(name)) {
      // Make sure the cipher algorithm remains the same,
      // but the key itself is different, for rotations.
      const existingKey = this.#state.keychain.get(name)!
      if (cipher.algorithm !== existingKey.cipher.algorithm) {
        throw new Error(`Cannot rotate key ${name} with different algorithm`)
      }
      if (
        serializedCipher.trim() ===
        _serializeCipher(this.sodium, existingKey.cipher).trim()
      ) {
        throw new Error('This key is already in your keychain')
      }
    }
    const withPersonalKey = this.usePersonalKey()
    const nameFingerprint = fingerprint(this.sodium, name)
    const payloadFingerprint = fingerprint(this.sodium, serializedCipher)
    const createdAtISO = createdAt.toISOString()
    const expiresAtISO = expiresAt?.toISOString() ?? null
    const body: PostKeychainItemRequestBody = {
      ownerId: this.#state.identity.userId,
      sharedBy,
      createdAt: createdAtISO,
      expiresAt: expiresAtISO,
      name: encrypt(
        this.sodium,
        name,
        withPersonalKey,
        encodedCiphertextFormatV1
      ),
      payload: encrypt(
        this.sodium,
        serializedCipher,
        withPersonalKey,
        encodedCiphertextFormatV1
      ),
      nameFingerprint,
      payloadFingerprint,
      signature: this.encode(
        signHash(
          this.sodium,
          this.#state.identity.signature.privateKey,
          this.sodium.from_string(this.#state.identity.userId),
          this.sodium.from_string(sharedBy ?? ''),
          this.sodium.from_string(createdAtISO),
          this.sodium.from_string(expiresAtISO ?? ''),
          this.sodium.from_base64(nameFingerprint),
          this.sodium.from_base64(payloadFingerprint)
        )
      ),
    }
    await this.apiCall('POST', '/keychain', body)
    // todo: Handle API errors
    this.#state.keychain.set(name, {
      name,
      cipher,
      createdAt,
      expiresAt,
      sharedBy,
    })
  }

  public getKeyByName(name: string) {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account must be unlocked before accessing keys')
    }
    return this.#state.keychain.get(name)?.cipher
  }

  // Sharing --

  public async shareKey(
    {
      cipher,
      name,
      expiresAt = null,
      createdAt,
    }: Omit<KeychainItem, 'sharedBy'>,
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
    const serializedCipher = _serializeCipher(this.sodium, cipher)
    const nameFingerprint = fingerprint(this.sodium, name)
    // Remove padding for payload fingerprint as it is not deterministic
    const payloadFingerprint = fingerprint(this.sodium, serializedCipher.trim())
    const createdAtISO = createdAt.toISOString()
    const expiresAtISO = expiresAt?.toISOString() ?? null
    const body: PostSharedKeyBody = {
      fromUserId: this.#state.identity.userId,
      fromSharingPublicKey: this.encode(this.#state.identity.sharing.publicKey),
      fromSignaturePublicKey: this.encode(
        this.#state.identity.signature.publicKey
      ),
      toUserId: to.userId,
      createdAt: createdAtISO,
      expiresAt: expiresAtISO,
      name: encrypt(this.sodium, name, sendTo, encodedCiphertextFormatV1),
      payload: encrypt(
        this.sodium,
        serializedCipher,
        sendTo,
        encodedCiphertextFormatV1
      ),
      nameFingerprint,
      payloadFingerprint,
      signature: this.encode(
        signHash(
          this.sodium,
          this.#state.identity.signature.privateKey,
          this.sodium.from_string(this.#state.identity.userId),
          this.sodium.from_string(to.userId),
          this.sodium.from_string(createdAtISO),
          this.sodium.from_string(expiresAtISO ?? ''),
          this.decode(nameFingerprint),
          this.decode(payloadFingerprint),
          this.#state.identity.sharing.publicKey,
          this.#state.identity.signature.publicKey
        )
      ),
    }
    return this.apiCall('POST', '/shared-keys', body)
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

  public async getUserIdentity(
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
    return base64UrlEncode(input)
  }

  public decode(input: string) {
    return base64UrlDecode(input)
  }

  // Internal APIs --

  private async loadKeychain() {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account must be unlocked before calling API')
    }
    const res = await this.apiCall<GetKeychainResponseBody>('GET', '/keychain')
    const withPersonalKey = this.usePersonalKey()
    for (const lockedItem of res) {
      if (lockedItem.ownerId !== this.#state.identity.userId) {
        console.warn('Got a key belonging to someone else', lockedItem)
        continue
      }
      if (
        !verifySignedHash(
          this.sodium,
          this.#state.identity.signature.publicKey,
          this.decode(lockedItem.signature),
          this.sodium.from_string(this.#state.identity.userId),
          this.sodium.from_string(lockedItem.sharedBy ?? ''),
          this.sodium.from_string(lockedItem.createdAt),
          this.sodium.from_string(lockedItem.expiresAt ?? ''),
          this.sodium.from_base64(lockedItem.nameFingerprint),
          this.sodium.from_base64(lockedItem.payloadFingerprint)
        )
      ) {
        console.warn('Invalid keychain entry detected:', lockedItem)
        continue
      }
      // todo: Decryption error handling
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
            lockedItem.payload,
            withPersonalKey,
            encodedCiphertextFormatV1
          )
        ),
        createdAt: new Date(lockedItem.createdAt),
        expiresAt: lockedItem.expiresAt ? new Date(lockedItem.expiresAt) : null,
        sharedBy: lockedItem.sharedBy,
      }
      this.#state.keychain.set(item.name, item)
    }
  }

  private async processIncomingSharedKeys() {
    if (this.#state.state !== 'loaded') {
      console.error('Account must be unlocked before receiving keys')
      return
    }
    let sharedKeys: GetSharedKeysResponseBody = []
    try {
      sharedKeys = await this.apiCall<GetSharedKeysResponseBody>(
        'GET',
        '/shared-keys/incoming'
      )
    } catch (error) {
      console.error(error)
    }
    for (const sharedKey of sharedKeys) {
      try {
        if (sharedKey.toUserId !== this.#state.identity.userId) {
          throw new Error("Got a shared key that doesn't belong to us")
        }
        if (
          !verifySignedHash(
            this.sodium,
            this.decode(sharedKey.fromSignaturePublicKey),
            this.decode(sharedKey.signature),
            this.sodium.from_string(sharedKey.fromUserId),
            this.sodium.from_string(this.#state.identity.userId),
            this.sodium.from_string(sharedKey.createdAt),
            this.sodium.from_string(sharedKey.expiresAt ?? ''),
            this.decode(sharedKey.nameFingerprint),
            this.decode(sharedKey.payloadFingerprint),
            this.decode(sharedKey.fromSharingPublicKey),
            this.decode(sharedKey.fromSignaturePublicKey)
          )
        ) {
          throw new Error('Invalid shared key signature')
        }
        const withSharedSecret: BoxCipher = {
          algorithm: 'box',
          privateKey: this.#state.identity.sharing.privateKey,
          publicKey: this.decode(sharedKey.fromSharingPublicKey),
        }
        const item: KeychainItem = {
          name: decrypt(
            this.sodium,
            sharedKey.name,
            withSharedSecret,
            encodedCiphertextFormatV1
          ),
          cipher: cipherParser.parse(
            decrypt(
              this.sodium,
              sharedKey.payload,
              withSharedSecret,
              encodedCiphertextFormatV1
            )
          ),
          createdAt: new Date(sharedKey.createdAt),
          expiresAt: sharedKey.expiresAt ? new Date(sharedKey.expiresAt) : null,
          sharedBy: sharedKey.fromUserId,
        }
        // Verify fingerprints
        if (
          fingerprint(
            this.sodium,
            _serializeCipher(this.sodium, item.cipher).trim()
          ) !== sharedKey.payloadFingerprint
        ) {
          throw new Error('Invalid shared key payload fingerprint')
        }
        if (fingerprint(this.sodium, item.name) !== sharedKey.nameFingerprint) {
          throw new Error('Invalid shared key name fingerprint')
        }
        await this.addKey(item)
        await this.config.onKeyReceived?.(item)
      } catch (error) {
        console.error(error)
        continue
      }
    }
  }

  private startMessagePolling() {
    return setInterval(
      this.processIncomingSharedKeys.bind(this),
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
    const timestamp = new Date().toISOString()
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
    if (isFarFromCurrentTime(timestamp, now)) {
      throw new Error(
        'Invalid server response timestamp (too far off current time)'
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

  // Persistance & cross-tab communication --

  private clearState() {
    if (this.#state.state !== 'loaded') {
      return
    }
    clearTimeout(this.#state.messagePollingHandle)
    this.sodium.memzero(this.#state.personalKey)
    this.sodium.memzero(this.#state.identity.sharing.privateKey)
    this.sodium.memzero(this.#state.identity.signature.privateKey)
    this.#state.keychain.forEach(item =>
      memzeroCipher(this.sodium, item.cipher)
    )
    this.#state.keychain.clear()
    this.#state = {
      state: 'idle',
    }
    this.#mitt.emit('identityUpdated', null)
  }

  // private serializeState() {
  //   if (this.#state.state === 'idle') {
  //     return JSON.stringify(this.#state)
  //   }
  //   const state = {
  //     state: this.#state.state,
  //     identity: {
  //       userId: this.#state.identity.userId,
  //       sharing: {
  //         publicKey: this.encode(this.#state.identity.sharing.publicKey),
  //         privateKey: this.encode(this.#state.identity.sharing.privateKey),
  //       },
  //       signature: {
  //         publicKey: this.encode(this.#state.identity.signature.publicKey),
  //         privateKey: this.encode(this.#state.identity.signature.privateKey),
  //       },
  //     },
  //     personalKey: this.encode(this.#state.personalKey),
  //     keychain: Array.from(this.#state.keychain.values()).map(item => ({
  //       ...item,
  //       cipher: this.serializeCipher(item.cipher),
  //     })),
  //   }
  //   return JSON.stringify(state)
  // }

  // private hydrateState(serializedState: string) {
  //   // todo: Use a parser
  //   const state = JSON.parse(serializedState)
  //   if (state.state === 'idle') {
  //     this.clearState()
  //   }
  //   // todo: Decode buffers & set to #state
  //   console.dir('hydrating state', state)
  // }

  // private syncState() {
  //   const state = this.serializeState()
  //   console.dir('syncing state', state)
  //   window.localStorage.setItem('e2esdk:state:sync', state)
  //   window.localStorage.removeItem('e2esdk:state:sync')
  // }

  // private handleStorageEvent(event: StorageEvent) {
  //   if (event.key !== 'e2esdk:state:sync' || !event.newValue) {
  //     return
  //   }
  //   this.hydrateState(event.newValue)
  // }
}

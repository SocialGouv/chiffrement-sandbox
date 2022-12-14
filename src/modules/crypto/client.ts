import { LocalStateSync } from 'local-state-sync'
import mitt, { Emitter } from 'mitt'
import { z } from 'zod'
import type { PostBanRequestBody } from '../api/ban.js'
import type {
  GetMultipleIdentitiesResponseBody,
  GetSingleIdentityResponseBody,
} from '../api/identity.js'
import type {
  GetKeychainResponseBody,
  PostKeychainItemRequestBody,
} from '../api/keychain.js'
import { loginResponseBody } from '../api/login.js'
import type {
  PermissionFlags,
  PostPermissionRequestBody,
} from '../api/permissions.js'
import type {
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
  cipherParser,
  CIPHER_MAX_PADDED_LENGTH,
  generateBoxKeyPair,
  memzeroCipher,
  SecretBoxCipher,
  _serializeCipher,
} from './ciphers.js'
import { base64UrlDecode, base64UrlEncode } from './codec.js'
import {
  decrypt,
  encodedCiphertextFormatV1,
  encrypt,
  EncryptableJSONDataType,
} from './encryption.js'
import { fingerprint } from './hash.js'
import {
  generateSignatureKeyPair,
  signHash,
  verifySignedHash,
} from './signHash.js'
import type { Sodium } from './sodium.js'
import {
  checkEncryptionPublicKey,
  checkSignaturePublicKey,
  randomPad,
} from './utils.js'

export type ClientConfig<KeyType = string> = {
  serverURL: string
  serverPublicKey: KeyType // todo: Make this an array to allow server key rotation
  pollingInterval?: number
  onKeyReceived?: (key: KeychainItem) => unknown
}

type Config = Omit<ClientConfig<Key>, 'pollingInterval'> &
  Required<Pick<ClientConfig<Key>, 'pollingInterval'>>

// --

const stringSchema = z.string()

// --

const keySchema = z.string().transform(base64UrlDecode)

type Key = Uint8Array

// --

const keyPairSchema = z.object({
  publicKey: keySchema,
  privateKey: keySchema,
})

// --

const keychainItemSchema = z.object({
  name: z.string(),
  nameFingerprint: z.string(),
  payloadFingerprint: z.string(),
  cipher: z
    .string()
    .transform(input => cipherParser.parse(JSON.parse(input.trim()))),
  createdAt: z.string().transform(value => new Date(value)),
  expiresAt: z
    .string()
    .transform(value => new Date(value))
    .nullable(),
  sharedBy: z.string().nullable(),
})

type KeychainItem = z.infer<typeof keychainItemSchema>

export type KeychainItemMetadata = Pick<
  KeychainItem,
  | 'name'
  | 'nameFingerprint'
  | 'payloadFingerprint'
  | 'createdAt'
  | 'expiresAt'
  | 'sharedBy'
> & {
  algorithm: z.infer<typeof cipherParser>['algorithm']
  publicKey?: string
}

// --

const keychainSchema = z.array(keychainItemSchema).transform(array =>
  array.reduce((map, item) => {
    map.set(
      item.name,
      [...(map.get(item.name) ?? []), item].sort(byCreatedAtMostRecentFirst)
    )
    return map
  }, new Map<string, KeychainItem[]>())
)

type Keychain = z.infer<typeof keychainSchema>

// --

const identitySchema = z.object({
  userId: z.string(),
  sharing: keyPairSchema,
  signature: keyPairSchema,
})

type Identity = z.infer<typeof identitySchema>

type PartialIdentity = Optional<Identity, 'sharing' | 'signature'>

// todo: Move to common type defs (also used by server)
export type PublicUserIdentity<KeyType = Key> = {
  userId: string
  signaturePublicKey: KeyType
  sharingPublicKey: KeyType
}

// --

type ShareKeyOptions = {
  expiresAt?: Date
}

// --

const idleStateSchema = z.object({
  state: z.literal('idle'),
})

const loadedStateSchema = z.object({
  state: z.literal('loaded'),
  identity: identitySchema,
  personalKey: keySchema,
  keychain: keychainSchema,
})

const stateSchema = z.discriminatedUnion('state', [
  idleStateSchema,
  loadedStateSchema,
])

type State = z.infer<typeof stateSchema>

// --

type Events = {
  identityUpdated: PublicUserIdentity | null
  keychainUpdated: null
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
  #sync: LocalStateSync<State>
  #pollingHandle?: ReturnType<typeof setInterval>

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
    this.#sync = new LocalStateSync({
      encryptionKey: 'HPJPr237wkeRQlbk3pC7tEugFLxGrvafTs6dvuXPWwY',
      namespace: 'e2esdk:sandbox',
      onStateUpdated: state => {
        if (state.state === 'idle') {
          this.clearState()
          return
        }
        const initialize = this.#state.state === 'idle'
        this.#state = state
        this.#mitt.emit('identityUpdated', this.publicIdentity)
        this.#mitt.emit('keychainUpdated', null)
        if (initialize) {
          this.sodium.ready
            .then(() => this.loadKeychain())
            .then(() => {
              this.startMessagePolling()
              return this.processIncomingSharedKeys()
            })
            .catch(console.error)
        }
      },
      stateParser,
      stateSerializer,
    })
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'visibilitychange',
        this._handleVisibilityChange.bind(this)
      )
    }
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
    if (this.#state.state !== 'idle') {
      throw new Error(
        'Please log out of your current account before signing up for another one'
      )
    }
    const identity: Identity = {
      userId,
      sharing: generateBoxKeyPair(this.sodium),
      signature: generateSignatureKeyPair(this.sodium),
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
    }
    try {
      await this.apiCall('POST', '/signup', body)
      this.startMessagePolling()
      this.#mitt.emit('identityUpdated', this.publicIdentity)
      this.#sync.setState(this.#state)
      return this.publicIdentity
    } catch (error) {
      this.clearState() // Cleanup on failure
      throw error
    }
  }

  public async login(userId: string, personalKey: Uint8Array) {
    await this.sodium.ready
    this.clearState()
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
    this.startMessagePolling()
    this.#state = {
      state: 'loaded',
      identity,
      personalKey,
      keychain: new Map(),
    }
    // Load keychain & incoming shared keys in the background
    this.loadKeychain().catch(console.error)
    this.processIncomingSharedKeys().catch(console.error)
    this.#mitt.emit('identityUpdated', this.publicIdentity)
    this.#sync.setState(this.#state)
    return this.publicIdentity
  }

  public logout() {
    this.clearState()
    this.#sync.setState(this.#state)
  }

  // Key Ops --

  public async addKey({
    name,
    cipher,
    createdAt = new Date(),
    expiresAt = null,
    sharedBy = null,
  }: Optional<
    Omit<KeychainItem, 'nameFingerprint' | 'payloadFingerprint'>,
    'createdAt' | 'expiresAt' | 'sharedBy'
  >): Promise<KeychainItemMetadata> {
    await this.sodium.ready
    if (this.#state.state !== 'loaded') {
      throw new Error('Account is locked')
    }
    const serializedCipher = _serializeCipher(cipher)
    if (this.#state.keychain.has(name)) {
      // Make sure the cipher algorithm remains the same,
      // but the key itself is different, for rotations.
      const [existingKey] = this.#state.keychain.get(name)!
      if (cipher.algorithm !== existingKey.cipher.algorithm) {
        throw new Error(`Cannot rotate key ${name} with different algorithm`)
      }
      if (
        serializedCipher.trim() === _serializeCipher(existingKey.cipher).trim()
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
        randomPad(serializedCipher, CIPHER_MAX_PADDED_LENGTH),
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
    addToKeychain(this.#state.keychain, {
      name,
      nameFingerprint,
      payloadFingerprint,
      cipher,
      createdAt,
      expiresAt,
      sharedBy,
    })
    this.#mitt.emit('keychainUpdated', null)
    this.#sync.setState(this.#state)
    return {
      name,
      nameFingerprint,
      payloadFingerprint,
      algorithm: cipher.algorithm,
      publicKey:
        cipher.algorithm !== 'secretBox'
          ? this.encode(cipher.publicKey)
          : undefined,
      createdAt,
      expiresAt,
      sharedBy,
    }
  }

  public getKeysBy(indexBy: 'name' | 'nameFingerprint') {
    if (this.#state.state !== 'loaded') {
      return {}
    }
    const out: Record<string, KeychainItemMetadata[]> = {}
    this.#state.keychain.forEach(items => {
      if (items.length === 0) {
        return
      }
      out[items[0][indexBy]] = items
        .map(({ cipher, ...item }) => {
          const publicKeyBuffer =
            cipher.algorithm === 'box'
              ? cipher.publicKey
              : cipher.algorithm === 'sealedBox'
              ? cipher.publicKey
              : undefined
          return {
            ...item,
            algorithm: cipher.algorithm,
            publicKey: publicKeyBuffer
              ? this.encode(publicKeyBuffer)
              : undefined,
          }
        })
        .sort(byCreatedAtMostRecentFirst)
    })
    return out
  }

  // Sharing --

  public async shareKey(
    keyName: string,
    to: PublicUserIdentity,
    { expiresAt }: ShareKeyOptions = {}
  ) {
    await this.sodium.ready
    if (this.#state.state !== 'loaded') {
      throw new Error('Account must be unlocked before sending keys')
    }
    const keychainItem = this.#state.keychain.get(keyName)?.[0]
    if (!keychainItem) {
      throw new Error(`No available key to share with name ${keyName}`)
    }
    const sendTo: BoxCipher = {
      algorithm: 'box',
      privateKey: this.#state.identity.sharing.privateKey,
      publicKey: to.sharingPublicKey,
    }
    const serializedCipher = _serializeCipher(keychainItem.cipher)
    const nameFingerprint = fingerprint(this.sodium, keychainItem.name)
    // Remove padding for payload fingerprint as it is not deterministic
    const payloadFingerprint = fingerprint(this.sodium, serializedCipher)
    const createdAtISO = keychainItem.createdAt.toISOString()
    const expiresAtISO =
      expiresAt?.toISOString() ?? keychainItem.expiresAt?.toISOString() ?? null
    const body: PostSharedKeyBody = {
      fromUserId: this.#state.identity.userId,
      fromSharingPublicKey: this.encode(this.#state.identity.sharing.publicKey),
      fromSignaturePublicKey: this.encode(
        this.#state.identity.signature.publicKey
      ),
      toUserId: to.userId,
      createdAt: createdAtISO,
      expiresAt: expiresAtISO,
      name: encrypt(
        this.sodium,
        keychainItem.name,
        sendTo,
        encodedCiphertextFormatV1
      ),
      payload: encrypt(
        this.sodium,
        randomPad(serializedCipher, CIPHER_MAX_PADDED_LENGTH),
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
    try {
      const res = await this.apiCall<GetSingleIdentityResponseBody>(
        'GET',
        `/identity/${userId}`
      )
      if (!res) {
        return null
      }
      if (res.userId !== userId) {
        throw new Error('Mismatching user IDs')
      }
      return this.decodeIdentity(res)
    } catch (error) {
      console.error(error)
      return null
    }
  }

  public async getUsersIdentities(
    userIds: string[]
  ): Promise<PublicUserIdentity[]> {
    await this.sodium.ready
    try {
      const res = await this.apiCall<GetMultipleIdentitiesResponseBody>(
        'GET',
        `/identities/${userIds.join(',')}`
      )
      return res.map(identity => this.decodeIdentity(identity))
    } catch (error) {
      console.error(error)
      return []
    }
  }

  // Permissions --

  public async setPermissions(
    userId: string,
    keyName: string,
    permissions: Partial<PermissionFlags>
  ) {
    const body: PostPermissionRequestBody = {
      userId,
      nameFingerprint: fingerprint(this.sodium, keyName),
      ...permissions,
    }
    await this.apiCall('POST', '/permissions', body)
  }

  public async banUser(userId: string, keyName: string) {
    const body: PostBanRequestBody = {
      userId,
      nameFingerprint: fingerprint(this.sodium, keyName),
    }
    await this.apiCall('POST', '/ban', body)
  }

  // Encryption / Decryption --

  public encrypt<DataType extends EncryptableJSONDataType | Uint8Array>(
    input: DataType,
    keyName: string
  ) {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account is locked: cannot encrypt')
    }
    const currentKey = this.#state.keychain.get(keyName)?.[0]
    if (!currentKey) {
      throw new Error(`No key found with name ${keyName}`)
    }
    if ((currentKey.expiresAt?.valueOf() ?? Infinity) < Date.now()) {
      throw new Error(`Key ${keyName} has expired`)
    }
    return encrypt(
      this.sodium,
      input,
      currentKey.cipher,
      'application/e2esdk.ciphertext.v1'
    )
  }

  public decrypt(ciphertext: string, keyName: string) {
    if (this.#state.state !== 'loaded') {
      throw new Error('Account is locked: cannot decrypt')
    }
    const keys = this.#state.keychain.get(keyName) ?? []
    if (keys.length === 0) {
      throw new Error(`No key found with name ${keyName}`)
    }
    for (const key of keys) {
      try {
        return decrypt(
          this.sodium,
          ciphertext,
          key.cipher,
          'application/e2esdk.ciphertext.v1'
        )
      } catch {
        continue
      }
    }
    throw new Error('Failed to decrypt: exhausted all available keys')
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
    await this.sodium.ready
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
        name: stringSchema.parse(
          decrypt(
            this.sodium,
            lockedItem.name,
            withPersonalKey,
            encodedCiphertextFormatV1
          )
        ),
        nameFingerprint: lockedItem.nameFingerprint,
        payloadFingerprint: lockedItem.payloadFingerprint,
        cipher: cipherParser.parse(
          JSON.parse(
            stringSchema
              .parse(
                decrypt(
                  this.sodium,
                  lockedItem.payload,
                  withPersonalKey,
                  encodedCiphertextFormatV1
                )
              )
              .trim()
          )
        ),
        createdAt: new Date(lockedItem.createdAt),
        expiresAt: lockedItem.expiresAt ? new Date(lockedItem.expiresAt) : null,
        sharedBy: lockedItem.sharedBy,
      }
      if (fingerprint(this.sodium, item.name) !== item.nameFingerprint) {
        console.warn('Invalid name fingerprint:', lockedItem)
        continue
      }
      if (
        fingerprint(this.sodium, _serializeCipher(item.cipher)) !==
        item.payloadFingerprint
      ) {
        console.warn('Invalid payload fingerprint', lockedItem)
        continue
      }
      addToKeychain(this.#state.keychain, item)
      this.#mitt.emit('keychainUpdated', null)
      this.#sync.setState(this.#state)
    }
  }

  private async processIncomingSharedKeys() {
    await this.sodium.ready
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
          name: stringSchema.parse(
            decrypt(
              this.sodium,
              sharedKey.name,
              withSharedSecret,
              encodedCiphertextFormatV1
            )
          ),
          nameFingerprint: sharedKey.nameFingerprint,
          payloadFingerprint: sharedKey.payloadFingerprint,
          cipher: cipherParser.parse(
            JSON.parse(
              stringSchema
                .parse(
                  decrypt(
                    this.sodium,
                    sharedKey.payload,
                    withSharedSecret,
                    encodedCiphertextFormatV1
                  )
                )
                .trim()
            )
          ),
          createdAt: new Date(sharedKey.createdAt),
          expiresAt: sharedKey.expiresAt ? new Date(sharedKey.expiresAt) : null,
          sharedBy: sharedKey.fromUserId,
        }
        // Verify fingerprints
        if (fingerprint(this.sodium, item.name) !== item.nameFingerprint) {
          throw new Error('Invalid shared key name fingerprint')
        }
        if (
          fingerprint(this.sodium, _serializeCipher(item.cipher)) !==
          item.payloadFingerprint
        ) {
          throw new Error('Invalid shared key payload fingerprint')
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
    clearInterval(this.#pollingHandle)
    this.#pollingHandle = setInterval(
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
    await this.sodium.ready
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
      const { error: statusText, statusCode, message } = await res.json()
      throw new APIError(statusCode, statusText, message)
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
    await this.sodium.ready
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
    clearTimeout(this.#pollingHandle)
    this.#pollingHandle = undefined
    if (this.#state.state !== 'loaded') {
      return
    }
    this.sodium.memzero(this.#state.personalKey)
    this.sodium.memzero(this.#state.identity.sharing.privateKey)
    this.sodium.memzero(this.#state.identity.signature.privateKey)
    this.#state.keychain.forEach(items =>
      items.forEach(item => memzeroCipher(this.sodium, item.cipher))
    )
    this.#state.keychain.clear()
    this.#state = {
      state: 'idle',
    }
    this.#mitt.emit('identityUpdated', null)
    this.#mitt.emit('keychainUpdated', null)
  }

  private _handleVisibilityChange() {
    if (this.#state.state !== 'loaded') {
      return
    }
    if (typeof document === 'undefined') {
      return
    }
    if (document.visibilityState === 'visible') {
      this.startMessagePolling()
    }
    if (document.visibilityState === 'hidden') {
      clearTimeout(this.#pollingHandle)
      this.#pollingHandle = undefined
    }
  }
}

// --

function stateSerializer(state: State) {
  if (state.state === 'idle') {
    return JSON.stringify(state)
  }
  const payload = {
    state: state.state,
    identity: {
      userId: state.identity.userId,
      sharing: {
        publicKey: base64UrlEncode(state.identity.sharing.publicKey),
        privateKey: base64UrlEncode(state.identity.sharing.privateKey),
      },
      signature: {
        publicKey: base64UrlEncode(state.identity.signature.publicKey),
        privateKey: base64UrlEncode(state.identity.signature.privateKey),
      },
    },
    personalKey: base64UrlEncode(state.personalKey),
    keychain: Array.from(state.keychain.values())
      .flat()
      .map(item => ({
        ...item,
        cipher: _serializeCipher(item.cipher),
      })),
  }
  return JSON.stringify(payload)
}

function stateParser(input: string): State {
  const result = stateSchema.safeParse(JSON.parse(input))
  if (!result.success) {
    console.error(result.error)
    throw new Error(result.error.message)
  }
  return result.data
}

// --

function serializeKeychainItem(item: KeychainItem) {
  return JSON.stringify({
    ...item,
    cipher: _serializeCipher(item.cipher),
  })
}

function addToKeychain(keychain: Keychain, newItem: KeychainItem) {
  const items = keychain.get(newItem.name) ?? []
  if (items.length === 0) {
    keychain.set(newItem.name, [newItem])
    return
  }
  const serialized = serializeKeychainItem(newItem)
  if (
    items.findIndex(item => serializeKeychainItem(item) === serialized) >= 0
  ) {
    return // Already in there
  }
  items.push(newItem)
  items.sort(byCreatedAtMostRecentFirst)
}

function byCreatedAtMostRecentFirst<T extends { createdAt: Date }>(a: T, b: T) {
  return b.createdAt.valueOf() - a.createdAt.valueOf()
}

// --

export class APIError extends Error {
  public readonly statusCode: number
  public readonly statusText: string
  constructor(statusCode: number, statusText: string, message: string) {
    super(message)
    this.name = 'API Error'
    this.statusCode = statusCode
    this.statusText = statusText
  }
}

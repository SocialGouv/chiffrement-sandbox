import type {
  StringOutputFormat,
  Uint8ArrayOutputFormat,
} from 'libsodium-wrappers'
import type { Sodium } from './sodium'
import {
  concat,
  decode,
  encode,
  isEncryptable,
  isUint8Array,
  split,
} from './utils'

export type BoxCipher = {
  algorithm: 'box'
  publicKey: Uint8Array
  privateKey: Uint8Array
  nonce?: Uint8Array
}

export type SealedBoxCipher = {
  algorithm: 'sealedBox'
  publicKey: Uint8Array
  privateKey?: Uint8Array
}

export type SecretBoxCipher = {
  algorithm: 'secretBox'
  key: Uint8Array
  nonce?: Uint8Array
}

// --

export enum PayloadType {
  bin = 'bin', // Uint8Array
  txt = 'txt', // string
  json = 'json', // number | boolean
}

export type Cipher = BoxCipher | SealedBoxCipher | SecretBoxCipher

const encodedCiphertextFormats = ['application/chiffre.ciphertext.v1'] as const

export type EncodedCiphertextFormat = typeof encodedCiphertextFormats[number]

export type EncryptableJSONDataType = string | number | boolean

// --

export function generateEncryptionKey(sodium: Sodium) {
  return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES)
}

export function generateEncryptionKeyPair(sodium: Sodium) {
  return sodium.crypto_box_keypair()
}

// --

/**
 * Encrypt input data into a string representation
 *
 * @param input The data to encrypt
 * @param cipher The algorithm to use and its parameters
 * @param outputFormat The format to use
 */
export function encrypt<DataType extends Uint8Array | EncryptableJSONDataType>(
  sodium: Sodium,
  input: DataType,
  cipher: Cipher,
  outputFormat?: StringOutputFormat | EncodedCiphertextFormat
): string

/**
 * Encrypt input data into a binary buffer
 *
 * This overload is recommended for binary inputs and where the cipher to use
 * is defined by convention.
 *
 * @param input The data to encrypt
 * @param cipher The algorithm to use and its parameters
 * @param outputFormat
 */
export function encrypt<DataType extends Uint8Array | EncryptableJSONDataType>(
  sodium: Sodium,
  input: DataType,
  cipher: Cipher,
  outputFormat?: Uint8ArrayOutputFormat
): Uint8Array

export function encrypt<DataType extends Uint8Array | EncryptableJSONDataType>(
  sodium: Sodium,
  input: DataType,
  cipher: Cipher,
  outputFormat:
    | Uint8ArrayOutputFormat
    | StringOutputFormat
    | EncodedCiphertextFormat = 'application/chiffre.ciphertext.v1'
) {
  const { payloadType, payload } = isUint8Array(input)
    ? {
        payloadType: PayloadType.bin,
        payload: input,
      }
    : typeof input === 'string'
    ? {
        payloadType: PayloadType.txt,
        payload: sodium.from_string(input),
      }
    : {
        payloadType: PayloadType.json,
        payload: sodium.from_string(JSON.stringify(input)),
      }

  if (cipher.algorithm === 'box') {
    const nonce =
      cipher.nonce ?? sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
    const ciphertext = sodium.crypto_box_easy(
      payload,
      nonce,
      cipher.publicKey,
      cipher.privateKey
    )
    if (outputFormat === 'application/chiffre.ciphertext.v1') {
      return [
        'v1',
        cipher.algorithm,
        payloadType,
        sodium.to_base64(nonce),
        sodium.to_base64(ciphertext),
      ].join('.')
    }
    if (outputFormat === 'uint8array') {
      return concat(nonce, ciphertext)
    }
    return encode(sodium, concat(nonce, ciphertext), outputFormat)
  }

  if (cipher.algorithm === 'sealedBox') {
    const ciphertext = sodium.crypto_box_seal(payload, cipher.publicKey)
    if (outputFormat === 'application/chiffre.ciphertext.v1') {
      // prettier-ignore
      return [
        'v1',
        cipher.algorithm,
        payloadType,
        sodium.to_base64(ciphertext),
      ].join('.')
    }
    if (outputFormat === 'uint8array') {
      return ciphertext
    }
    return encode(sodium, ciphertext, outputFormat)
  }

  if (cipher.algorithm === 'secretBox') {
    const nonce =
      cipher.nonce ?? sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
    const ciphertext = sodium.crypto_secretbox_easy(payload, nonce, cipher.key)
    if (outputFormat === 'application/chiffre.ciphertext.v1') {
      return [
        'v1',
        cipher.algorithm,
        payloadType,
        sodium.to_base64(nonce),
        sodium.to_base64(ciphertext),
      ].join('.')
    }
    if (outputFormat === 'uint8array') {
      return concat(nonce, ciphertext)
    }
    return encode(sodium, concat(nonce, ciphertext), outputFormat)
  }
}

// --

export function decrypt(
  sodium: Sodium,
  input: Uint8Array,
  cipher: Cipher
): Uint8Array

export function decrypt(
  sodium: Sodium,
  input: string,
  cipher: Cipher,
  inputEncoding: StringOutputFormat
): Uint8Array

export function decrypt<Output = any>(
  sodium: Sodium,
  input: string,
  cipher: Cipher,
  inputEncoding: EncodedCiphertextFormat
): Output

export function decrypt<Output = any>(
  sodium: Sodium,
  input: string | Uint8Array,
  cipher: Cipher,
  inputEncoding?: StringOutputFormat | EncodedCiphertextFormat
) {
  if (typeof input === 'string' && !inputEncoding) {
    throw new TypeError(
      'Missing required inputEncoding argument for string-encoded ciphertext'
    )
  }

  const payload = isUint8Array(input)
    ? input
    : inputEncoding === 'application/chiffre.ciphertext.v1'
    ? input.split('.')
    : decode(sodium, input, inputEncoding!)

  if (payload[0] === 'v1' && payload[1] !== cipher.algorithm) {
    throw new Error(
      `Invalid algorithm: expected to decrypt ${cipher.algorithm}, but got ${payload[1]} instead.`
    )
  }

  if (cipher.algorithm === 'box') {
    const [nonce, ciphertext] = isUint8Array(payload)
      ? split(payload, sodium.crypto_box_NONCEBYTES)
      : [sodium.from_base64(payload[3]), sodium.from_base64(payload[4])]
    // When providing the nonce via the cipher parameters,
    // make sure it matches the one embedded in the message.
    if (cipher.nonce && 0 !== sodium.compare(nonce, cipher.nonce)) {
      throw new Error('Mismatch between provided & embedded nonces')
    }
    const plaintext = sodium.crypto_box_open_easy(
      ciphertext,
      nonce,
      cipher.publicKey,
      cipher.privateKey
    )
    return decodePayload<Output>(sodium, payload, plaintext)
  }

  if (cipher.algorithm === 'sealedBox') {
    if (!cipher.privateKey) {
      throw new Error('Private key is required to open sealed boxes')
    }
    const ciphertext = isUint8Array(payload)
      ? payload
      : sodium.from_base64(payload[3])
    const plaintext = sodium.crypto_box_seal_open(
      ciphertext,
      cipher.publicKey,
      cipher.privateKey
    )
    return decodePayload<Output>(sodium, payload, plaintext)
  }

  if (cipher.algorithm === 'secretBox') {
    const [nonce, ciphertext] = isUint8Array(payload)
      ? split(payload, sodium.crypto_secretbox_NONCEBYTES)
      : [sodium.from_base64(payload[3]), sodium.from_base64(payload[4])]
    // When providing the nonce via the cipher parameters,
    // make sure it matches the one embedded in the message.
    if (cipher.nonce && 0 !== sodium.compare(nonce, cipher.nonce)) {
      throw new Error('Mismatch between provided & embedded nonces')
    }
    const plaintext = sodium.crypto_secretbox_open_easy(
      ciphertext,
      nonce,
      cipher.key
    )
    return decodePayload<Output>(sodium, payload, plaintext)
  }
}

function decodePayload<Output>(
  sodium: Sodium,
  payload: Uint8Array | string[],
  plaintext: Uint8Array
) {
  if (isUint8Array(payload)) {
    return plaintext
  }
  const payloadType = payload[2]
  if (payloadType === PayloadType.bin) {
    return plaintext
  }
  if (payloadType === PayloadType.txt) {
    return sodium.to_string(plaintext)
  }
  if (payloadType === PayloadType.json) {
    return JSON.parse(sodium.to_string(plaintext)) as Output
  }
  throw new Error(`Unknown payload type ${payloadType}`)
}

// Higher-level interfaces --

export function encryptObject<Object extends object>(
  sodium: Sodium,
  input: Object,
  cipher: Cipher
) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (!isEncryptable(value)) {
        return [key, value]
      }
      try {
        return [
          key,
          encrypt(sodium, value, cipher, 'application/chiffre.ciphertext.v1'),
        ]
      } catch {
        return [key, value]
      }
    })
  )
}

export function decryptObject<Object extends object>(
  sodium: Sodium,
  input: Object,
  cipher: Cipher
) {
  type ObjectDecryptionError = {
    key: string
    error: string
  }
  const errors: ObjectDecryptionError[] = []
  const result = Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      try {
        return [key, decrypt(sodium, value, cipher)]
      } catch (error) {
        errors.push({
          key,
          error: String(error),
        })
        return [key, value]
      }
    })
  )
  if (errors.length) {
    console.error(errors)
  }
  return result
}

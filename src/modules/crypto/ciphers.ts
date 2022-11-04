import { z } from 'zod'
import { base64UrlDecode, base64UrlEncode } from './codec.js'
import { Sodium } from './sodium.js'

export type BoxCipher<DataType = Uint8Array> = {
  algorithm: 'box'
  publicKey: DataType
  privateKey: DataType
  nonce?: DataType
}

export type SealedBoxCipher<DataType = Uint8Array> = {
  algorithm: 'sealedBox'
  publicKey: DataType
  privateKey: DataType
}

export type SecretBoxCipher<DataType = Uint8Array> = {
  algorithm: 'secretBox'
  key: DataType
  nonce?: DataType
}

export type Cipher = BoxCipher | SealedBoxCipher | SecretBoxCipher

// Factories --

export function generateBoxCipher(
  sodium: Sodium,
  nonce?: Uint8Array
): BoxCipher {
  // todo: This make little sense, box is supposed to be
  // DH over different identities.
  const keyPair = sodium.crypto_box_keypair()
  return {
    algorithm: 'box',
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    nonce,
  }
}

export function generateSealedBoxCipher(sodium: Sodium): SealedBoxCipher {
  const keyPair = sodium.crypto_box_keypair()
  return {
    algorithm: 'sealedBox',
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  }
}

export function generateSecretBoxCipher(
  sodium: Sodium,
  nonce?: Uint8Array
): SecretBoxCipher {
  return {
    algorithm: 'secretBox',
    key: sodium.crypto_secretbox_keygen(),
    nonce,
  }
}

// Serializer --

export const CIPHER_MAX_PADDED_LENGTH = 150

/**
 * @internal Exported for tests - Stringify the given cipher
 *
 * @warning This will not encrypt the keys, they will only be base64 encoded as-is.
 * This should only be used to feed to the `encrypt` function.
 */
export function _serializeCipher(cipher: Cipher) {
  if (cipher.algorithm === 'box') {
    // todo: Does this make sense?
    const payload: Omit<BoxCipher<string>, 'nonce'> = {
      algorithm: cipher.algorithm,
      publicKey: base64UrlEncode(cipher.publicKey),
      privateKey: base64UrlEncode(cipher.privateKey),
    }
    return JSON.stringify(payload)
  }
  if (cipher.algorithm === 'sealedBox') {
    const payload: SealedBoxCipher<string> = {
      algorithm: cipher.algorithm,
      publicKey: base64UrlEncode(cipher.publicKey),
      privateKey: base64UrlEncode(cipher.privateKey),
    }
    return JSON.stringify(payload)
  }
  if (cipher.algorithm === 'secretBox') {
    const payload: Omit<SecretBoxCipher<string>, 'nonce'> = {
      algorithm: cipher.algorithm,
      key: base64UrlEncode(cipher.key),
    }
    return JSON.stringify(payload)
  }
  throw new Error('Unsupported cipher algorithm')
}

// Parsers --

const thirtyTwoBytesInBase64Parser = z
  .string()
  .regex(/^[\w-]{43}$/)
  .transform(base64UrlDecode)

const boxCipherParser = z.object({
  algorithm: z.literal('box'),
  publicKey: thirtyTwoBytesInBase64Parser,
  privateKey: thirtyTwoBytesInBase64Parser,
})

const sealedBoxCipherParser = z.object({
  algorithm: z.literal('sealedBox'),
  publicKey: thirtyTwoBytesInBase64Parser,
  privateKey: thirtyTwoBytesInBase64Parser,
})

const secretBoxCipherParser = z.object({
  algorithm: z.literal('secretBox'),
  key: thirtyTwoBytesInBase64Parser,
})

export const cipherParser = z.union([
  boxCipherParser,
  sealedBoxCipherParser,
  secretBoxCipherParser,
])

export function isBoxCipher(cipher: Cipher): cipher is BoxCipher {
  return boxCipherParser.safeParse(cipher).success
}

export function isSealedBoxCipher(cipher: Cipher): cipher is SealedBoxCipher {
  return sealedBoxCipherParser.safeParse(cipher).success
}

export function isSecretBoxCipher(cipher: Cipher): cipher is SecretBoxCipher {
  return secretBoxCipherParser.safeParse(cipher).success
}

// Utility --

export function memzeroCipher(sodium: Sodium, cipher: Cipher) {
  if (cipher.algorithm === 'box') {
    sodium.memzero(cipher.privateKey)
    if (cipher.nonce) {
      sodium.memzero(cipher.nonce)
    }
    return
  }
  if (cipher.algorithm === 'sealedBox') {
    sodium.memzero(cipher.privateKey)
    return
  }
  if (cipher.algorithm === 'secretBox') {
    sodium.memzero(cipher.key)
    if (cipher.nonce) {
      sodium.memzero(cipher.nonce)
    }
    return
  }
  throw new Error('Unsupported cipher algorithm')
}

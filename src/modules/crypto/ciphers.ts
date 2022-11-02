import { z } from 'zod'
import { sodium, Sodium } from './sodium.js'
import { randomPad } from './utils.js'

export type BoxCipher<DataType = Uint8Array> = {
  algorithm: 'box'
  publicKey: DataType
  privateKey: DataType
  nonce?: DataType
}

export type SealedBoxCipher<DataType = Uint8Array> = {
  algorithm: 'sealedBox'
  publicKey: DataType
  privateKey?: DataType
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
  // todo: These make little sense, box & sealedBox are supposed to be
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
  // todo: These make little sense, box & sealedBox are supposed to be
  // DH over different identities.
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

/**
 * @internal Exported for tests
 *
 * Stringify the given cipher, with padding to ensure constant output length.
 *
 * @warning This will not encrypt the keys, they will only be base64 encoded as-is.
 * This should only be used to feed to the `encrypt` function.
 */
export function _serializeCipher(sodium: Sodium, cipher: Cipher) {
  if (cipher.algorithm === 'box') {
    // todo: Does this make sense?
    const payload: Omit<BoxCipher<string>, 'nonce'> = {
      algorithm: cipher.algorithm,
      publicKey: sodium.to_base64(cipher.publicKey),
      privateKey: sodium.to_base64(cipher.privateKey),
    }
    return randomPad(JSON.stringify(payload), 150)
  }
  if (cipher.algorithm === 'sealedBox') {
    if (!cipher.privateKey) {
      throw new Error('Missing private key in sealedBox cipher')
    }
    const payload: SealedBoxCipher<string> = {
      algorithm: cipher.algorithm,
      publicKey: sodium.to_base64(cipher.publicKey),
      privateKey: sodium.to_base64(cipher.privateKey),
    }
    return randomPad(JSON.stringify(payload), 150)
  }
  if (cipher.algorithm === 'secretBox') {
    const payload: Omit<SecretBoxCipher<string>, 'nonce'> = {
      algorithm: cipher.algorithm,
      key: sodium.to_base64(cipher.key),
    }
    return randomPad(JSON.stringify(payload), 150)
  }
  throw new Error('Unsupported cipher algorithm')
}

// Parsers --

const thirtyTwoBytesInBase64Parser = z
  .string()
  .regex(/^[\w-]{43}$/)
  .transform(value => sodium.from_base64(value))

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
  }
  if (cipher.algorithm === 'sealedBox' && cipher.privateKey) {
    sodium.memzero(cipher.privateKey)
  }
  if (cipher.algorithm === 'secretBox') {
    sodium.memzero(cipher.key)
    if (cipher.nonce) {
      sodium.memzero(cipher.nonce)
    }
  }
  throw new Error('Unsupported cipher algorithm')
}

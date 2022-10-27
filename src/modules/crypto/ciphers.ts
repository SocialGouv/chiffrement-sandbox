import { z } from 'zod'
import { sodium, Sodium } from './sodium.js'

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

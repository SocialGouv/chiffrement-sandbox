import {
  BoxCipher,
  CIPHER_MAX_PADDED_LENGTH,
  generateBoxCipher,
  generateBoxKeyPair,
  generateSealedBoxCipher,
  generateSecretBoxCipher,
  SecretBoxCipher,
  _serializeCipher,
} from './ciphers.js'
import { ready, Sodium, sodium } from './sodium.js'

// --

type OptionalNonce = {
  nonce?: Uint8Array
}

export function _generateBoxCipher(
  sodium: Sodium,
  nonce?: Uint8Array
): BoxCipher & OptionalNonce {
  const keyPair = sodium.crypto_box_keypair()
  return {
    algorithm: 'box',
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    nonce,
  }
}

export function _generateSecretBoxCipher(
  sodium: Sodium,
  nonce?: Uint8Array
): SecretBoxCipher & OptionalNonce {
  return {
    algorithm: 'secretBox',
    key: sodium.crypto_secretbox_keygen(),
    nonce,
  }
}

// --

beforeAll(() => ready)

describe('crypto/ciphers', () => {
  test('CIPHER_MAX_PADDED_LENGTH', () => {
    const boxKeyPair = generateBoxKeyPair(sodium)
    const a = generateBoxCipher(boxKeyPair.publicKey, boxKeyPair.privateKey)
    const b = generateSealedBoxCipher(sodium)
    const c = generateSecretBoxCipher(sodium)
    expect(_serializeCipher(a).length).toBeLessThan(CIPHER_MAX_PADDED_LENGTH)
    expect(_serializeCipher(b).length).toBeLessThan(CIPHER_MAX_PADDED_LENGTH)
    expect(_serializeCipher(c).length).toBeLessThan(CIPHER_MAX_PADDED_LENGTH)
  })
})

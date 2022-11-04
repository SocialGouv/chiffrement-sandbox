import {
  CIPHER_MAX_PADDED_LENGTH,
  generateBoxCipher,
  generateSealedBoxCipher,
  generateSecretBoxCipher,
  _serializeCipher,
} from './ciphers'
import { ready, sodium } from './sodium.js'

beforeAll(() => ready)

describe('crypto/ciphers', () => {
  test('CIPHER_MAX_PADDED_LENGTH', () => {
    const a = generateBoxCipher(
      sodium,
      sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
    )
    const b = generateSealedBoxCipher(sodium)
    const c = generateSecretBoxCipher(
      sodium,
      sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
    )
    expect(_serializeCipher(a).length).toBeLessThan(CIPHER_MAX_PADDED_LENGTH)
    expect(_serializeCipher(b).length).toBeLessThan(CIPHER_MAX_PADDED_LENGTH)
    expect(_serializeCipher(c).length).toBeLessThan(CIPHER_MAX_PADDED_LENGTH)
  })
})

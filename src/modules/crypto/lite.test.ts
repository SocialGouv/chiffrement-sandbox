import { generateSealedBoxCipher } from './ciphers.js'
import { decrypt } from './encryption.js'
import { seal } from './lite.js'
import { ready, sodium } from './sodium.js'

beforeAll(() => ready)

describe('crypto/lite', () => {
  test('lite sealed boxes are compatible with libsodium', () => {
    const input = sodium.randombytes_buf(32)
    const cipher = generateSealedBoxCipher(sodium)
    const ciphertext = seal(input, cipher.publicKey)
    const cleartext = decrypt(sodium, ciphertext, cipher)
    expect(cleartext).toEqual(input)
  })
})

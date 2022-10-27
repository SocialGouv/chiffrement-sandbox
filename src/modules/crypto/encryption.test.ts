import {
  generateBoxCipher,
  generateSealedBoxCipher,
  generateSecretBoxCipher,
} from './ciphers.js'
import { decrypt, encodedCiphertextFormatV1, encrypt } from './encryption.js'
import { ready, sodium } from './sodium.js'
import { concat } from './utils.js'

beforeAll(() => ready)

const BUFFER_SIZES = [32, 128, 1234, 1 << 16]

const STRING_INPUTS = Object.entries({
  'empty string': '',
  emoji: '😀',
  'hello world': 'Hello, world!',
  poem: `
    A Elbereth Gilthoniel
    silivren penna míriel
    o menel aglar elenath!
    Na-chaered palan-díriel
    o galadhremmin ennorath,
    Fanuilos, le linnathon
    nef aear, sí nef aearon!
  `,
})

const NUMBER_INPUTS = [
  0,
  1,
  1234567890,
  1 << 24,
  (1 << 32) - 1,
  -1 << 22,
  Math.PI,
  Math.sqrt(2),
]

describe('encryption', () => {
  describe('box', () => {
    describe.each(BUFFER_SIZES)('buffer input (size %d)', cleartextLength => {
      test('-> buffer', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(cleartext).toEqual(input)
        expect(ciphertext.byteLength).toEqual(
          sodium.crypto_box_NONCEBYTES +
            cleartextLength +
            sodium.crypto_box_MACBYTES
        )
      })

      test('-> hex', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(cleartext).toEqual(input)
        expect(ciphertext.length).toEqual(
          2 *
            (sodium.crypto_box_NONCEBYTES +
              cleartextLength +
              sodium.crypto_box_MACBYTES)
        )
      })

      test('-> base64', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(cleartext).toEqual(input)
        expect(ciphertext.length).toEqual(
          Math.ceil(
            (4 / 3) *
              (sodium.crypto_box_NONCEBYTES +
                cleartextLength +
                sodium.crypto_box_MACBYTES)
          )
        )
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const input = sodium.randombytes_buf(32)
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 11)).toBe('v1.box.bin.')
        expect(ciphertext.split('.').length).toBe(5)
      })

      test('output format equivalence', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
        const cipher = generateBoxCipher(sodium, nonce)
        const buffer = encrypt(sodium, input, cipher, 'uint8array')
        const hex = encrypt(sodium, input, cipher, 'hex')
        const base64 = encrypt(sodium, input, cipher, 'base64')
        const v1 = encrypt(sodium, input, cipher, encodedCiphertextFormatV1)

        expect(sodium.from_hex(hex)).toEqual(buffer)
        expect(sodium.from_base64(base64)).toEqual(buffer)
        expect(
          concat(
            sodium.from_base64(v1.split('.')[3]),
            sodium.from_base64(v1.split('.')[4])
          )
        ).toEqual(buffer)
      })
    })

    describe.each(STRING_INPUTS)('string input (%s)', (_, input) => {
      test('-> buffer', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.byteLength).toEqual(
          sodium.crypto_box_NONCEBYTES +
            cleartext.byteLength +
            sodium.crypto_box_MACBYTES
        )
      })

      test('-> hex', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.length).toEqual(
          2 *
            (sodium.crypto_box_NONCEBYTES +
              cleartext.byteLength +
              sodium.crypto_box_MACBYTES)
        )
      })

      test('-> base64', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.length).toEqual(
          Math.ceil(
            (4 / 3) *
              (sodium.crypto_box_NONCEBYTES +
                cleartext.byteLength +
                sodium.crypto_box_MACBYTES)
          )
        )
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 11)).toBe('v1.box.txt.')
        expect(ciphertext.split('.').length).toBe(5)
      })

      test('output format equivalence', async () => {
        const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
        const cipher = generateBoxCipher(sodium, nonce)
        const buffer = encrypt(sodium, input, cipher, 'uint8array')
        const hex = encrypt(sodium, input, cipher, 'hex')
        const base64 = encrypt(sodium, input, cipher, 'base64')
        const v1 = encrypt(sodium, input, cipher, encodedCiphertextFormatV1)

        expect(sodium.from_hex(hex)).toEqual(buffer)
        expect(sodium.from_base64(base64)).toEqual(buffer)
        expect(
          concat(
            sodium.from_base64(v1.split('.')[3]),
            sodium.from_base64(v1.split('.')[4])
          )
        ).toEqual(buffer)
      })
    })

    describe.each(NUMBER_INPUTS)('number input (%d)', input => {
      test('-> buffer', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> hex', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> base64', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 12)).toBe('v1.box.json.')
        expect(ciphertext.split('.').length).toBe(5)
      })

      test('output format equivalence', async () => {
        const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
        const cipher = generateBoxCipher(sodium, nonce)
        const buffer = encrypt(sodium, input, cipher, 'uint8array')
        const hex = encrypt(sodium, input, cipher, 'hex')
        const base64 = encrypt(sodium, input, cipher, 'base64')
        const v1 = encrypt(sodium, input, cipher, encodedCiphertextFormatV1)

        expect(sodium.from_hex(hex)).toEqual(buffer)
        expect(sodium.from_base64(base64)).toEqual(buffer)
        expect(
          concat(
            sodium.from_base64(v1.split('.')[3]),
            sodium.from_base64(v1.split('.')[4])
          )
        ).toEqual(buffer)
      })
    })

    describe.each([true, false])('boolean input (%s)', input => {
      test('boolean -> buffer', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('boolean -> hex', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('boolean -> base64', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('boolean -> encodedCiphertextFormatV1', async () => {
        const cipher = generateBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 12)).toBe('v1.box.json.')
        expect(ciphertext.split('.').length).toBe(5)
      })

      test('boolean -> output format equivalence', async () => {
        const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
        const cipher = generateBoxCipher(sodium, nonce)
        const buffer = encrypt(sodium, input, cipher, 'uint8array')
        const hex = encrypt(sodium, input, cipher, 'hex')
        const base64 = encrypt(sodium, input, cipher, 'base64')
        const v1 = encrypt(sodium, input, cipher, encodedCiphertextFormatV1)

        expect(sodium.from_hex(hex)).toEqual(buffer)
        expect(sodium.from_base64(base64)).toEqual(buffer)
        expect(
          concat(
            sodium.from_base64(v1.split('.')[3]),
            sodium.from_base64(v1.split('.')[4])
          )
        ).toEqual(buffer)
      })
    })
  })

  // ---------------------------------------------------------------------------

  describe('secretBox', () => {
    describe.each(BUFFER_SIZES)('buffer input (size %d)', cleartextLength => {
      test('-> buffer', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(cleartext).toEqual(input)
        expect(ciphertext.byteLength).toEqual(
          sodium.crypto_secretbox_NONCEBYTES +
            cleartextLength +
            sodium.crypto_secretbox_MACBYTES
        )
      })

      test('-> hex', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(cleartext).toEqual(input)
        expect(ciphertext.length).toEqual(
          2 *
            (sodium.crypto_secretbox_NONCEBYTES +
              cleartextLength +
              sodium.crypto_secretbox_MACBYTES)
        )
      })

      test('-> base64', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(cleartext).toEqual(input)
        expect(ciphertext.length).toEqual(
          Math.ceil(
            (4 / 3) *
              (sodium.crypto_secretbox_NONCEBYTES +
                cleartextLength +
                sodium.crypto_secretbox_MACBYTES)
          )
        )
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const input = sodium.randombytes_buf(32)
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 17)).toBe('v1.secretBox.bin.')
        expect(ciphertext.split('.').length).toBe(5)
      })

      test('output format equivalence', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
        const cipher = generateSecretBoxCipher(sodium, nonce)
        const buffer = encrypt(sodium, input, cipher, 'uint8array')
        const hex = encrypt(sodium, input, cipher, 'hex')
        const base64 = encrypt(sodium, input, cipher, 'base64')
        const v1 = encrypt(sodium, input, cipher, encodedCiphertextFormatV1)

        expect(sodium.from_hex(hex)).toEqual(buffer)
        expect(sodium.from_base64(base64)).toEqual(buffer)
        expect(
          concat(
            sodium.from_base64(v1.split('.')[3]),
            sodium.from_base64(v1.split('.')[4])
          )
        ).toEqual(buffer)
      })
    })

    describe.each(STRING_INPUTS)('string input (%s)', (_, input) => {
      test('-> buffer', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.byteLength).toEqual(
          sodium.crypto_secretbox_NONCEBYTES +
            cleartext.byteLength +
            sodium.crypto_secretbox_MACBYTES
        )
      })

      test('-> hex', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.length).toEqual(
          2 *
            (sodium.crypto_secretbox_NONCEBYTES +
              cleartext.byteLength +
              sodium.crypto_secretbox_MACBYTES)
        )
      })

      test('-> base64', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.length).toEqual(
          Math.ceil(
            (4 / 3) *
              (sodium.crypto_secretbox_NONCEBYTES +
                cleartext.byteLength +
                sodium.crypto_secretbox_MACBYTES)
          )
        )
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 17)).toBe('v1.secretBox.txt.')
        expect(ciphertext.split('.').length).toBe(5)
      })

      test('output format equivalence', async () => {
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
        const cipher = generateSecretBoxCipher(sodium, nonce)
        const buffer = encrypt(sodium, input, cipher, 'uint8array')
        const hex = encrypt(sodium, input, cipher, 'hex')
        const base64 = encrypt(sodium, input, cipher, 'base64')
        const v1 = encrypt(sodium, input, cipher, encodedCiphertextFormatV1)
        expect(sodium.from_hex(hex)).toEqual(buffer)
        expect(sodium.from_base64(base64)).toEqual(buffer)
        expect(
          concat(
            sodium.from_base64(v1.split('.')[3]),
            sodium.from_base64(v1.split('.')[4])
          )
        ).toEqual(buffer)
      })
    })

    describe.each(NUMBER_INPUTS)('number input (%f)', input => {
      test('-> buffer', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> hex', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> base64', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 18)).toBe('v1.secretBox.json.')
        expect(ciphertext.split('.').length).toBe(5)
      })

      test('output format equivalence', async () => {
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
        const cipher = generateSecretBoxCipher(sodium, nonce)
        const buffer = encrypt(sodium, input, cipher, 'uint8array')
        const hex = encrypt(sodium, input, cipher, 'hex')
        const base64 = encrypt(sodium, input, cipher, 'base64')
        const v1 = encrypt(sodium, input, cipher, encodedCiphertextFormatV1)
        expect(sodium.from_hex(hex)).toEqual(buffer)
        expect(sodium.from_base64(base64)).toEqual(buffer)
        expect(
          concat(
            sodium.from_base64(v1.split('.')[3]),
            sodium.from_base64(v1.split('.')[4])
          )
        ).toEqual(buffer)
      })
    })

    describe.each([true, false])('boolean input (%s)', input => {
      test('-> buffer', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> hex', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> base64', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const cipher = generateSecretBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 18)).toBe('v1.secretBox.json.')
        expect(ciphertext.split('.').length).toBe(5)
      })

      test('output format equivalence', async () => {
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
        const cipher = generateSecretBoxCipher(sodium, nonce)
        const buffer = encrypt(sodium, input, cipher, 'uint8array')
        const hex = encrypt(sodium, input, cipher, 'hex')
        const base64 = encrypt(sodium, input, cipher, 'base64')
        const v1 = encrypt(sodium, input, cipher, encodedCiphertextFormatV1)
        expect(sodium.from_hex(hex)).toEqual(buffer)
        expect(sodium.from_base64(base64)).toEqual(buffer)
        expect(
          concat(
            sodium.from_base64(v1.split('.')[3]),
            sodium.from_base64(v1.split('.')[4])
          )
        ).toEqual(buffer)
      })
    })
  })

  // ---------------------------------------------------------------------------

  describe('sealedBox', () => {
    describe.each(BUFFER_SIZES)('buffer input (size %d)', cleartextLength => {
      test('-> buffer', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(cleartext).toEqual(input)
        expect(ciphertext.byteLength).toEqual(
          sodium.crypto_box_SEALBYTES + cleartextLength
        )
      })

      test('-> hex', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(cleartext).toEqual(input)
        expect(ciphertext.length).toEqual(
          2 * (sodium.crypto_box_SEALBYTES + cleartextLength)
        )
      })

      test('-> base64', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(cleartext).toEqual(input)
        expect(ciphertext.length).toEqual(
          Math.ceil((4 / 3) * (sodium.crypto_box_SEALBYTES + cleartextLength))
        )
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const input = sodium.randombytes_buf(cleartextLength)
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 17)).toBe('v1.sealedBox.bin.')
        expect(ciphertext.split('.').length).toBe(4)
      })
    })

    describe.each(STRING_INPUTS)('string input (%s)', (_, input) => {
      test('-> buffer', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.byteLength).toEqual(
          sodium.crypto_box_SEALBYTES + cleartext.byteLength
        )
      })

      test('-> hex', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.length).toEqual(
          2 * (sodium.crypto_box_SEALBYTES + cleartext.byteLength)
        )
      })

      test('-> base64', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(sodium.to_string(cleartext)).toEqual(input)
        expect(ciphertext.length).toEqual(
          Math.ceil(
            (4 / 3) * (sodium.crypto_box_SEALBYTES + cleartext.byteLength)
          )
        )
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 17)).toBe('v1.sealedBox.txt.')
        expect(ciphertext.split('.').length).toBe(4)
      })
    })

    describe.each(NUMBER_INPUTS)('number input (%f)', input => {
      test('-> buffer', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> hex', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> base64', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 18)).toBe('v1.sealedBox.json.')
        expect(ciphertext.split('.').length).toBe(4)
      })
    })

    describe.each([true, false])('boolean input (%s)', input => {
      test('-> buffer', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'uint8array')
        const cleartext = decrypt(sodium, ciphertext, cipher)
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> hex', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'hex')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'hex')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> base64', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(sodium, input, cipher, 'base64')
        const cleartext = decrypt(sodium, ciphertext, cipher, 'base64')
        expect(JSON.parse(sodium.to_string(cleartext))).toEqual(input)
      })

      test('-> encodedCiphertextFormatV1', async () => {
        const cipher = generateSealedBoxCipher(sodium)
        const ciphertext = encrypt(
          sodium,
          input,
          cipher,
          encodedCiphertextFormatV1
        )
        const cleartext = decrypt(
          sodium,
          ciphertext,
          cipher,
          encodedCiphertextFormatV1
        )
        expect(cleartext).toEqual(input)
        expect(ciphertext.slice(0, 18)).toBe('v1.sealedBox.json.')
        expect(ciphertext.split('.').length).toBe(4)
      })
    })
  })
})

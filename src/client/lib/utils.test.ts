import { ready, sodium } from './sodium'
import {
  checkEncryptionPublicKey,
  checkSignaturePublicKey,
  concat,
  split,
} from './utils'

beforeAll(() => ready)

describe('utils', () => {
  test('concat', () => {
    const a = new Uint8Array([1, 2, 3, 4])
    const b = new Uint8Array([5, 6, 7, 8])
    const c = new Uint8Array([9, 10])
    const cat = concat(a, b, c)
    expect(cat).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  })

  test('split', () => {
    const input = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const [a, b] = split(input, 4)
    expect(a).toEqual(new Uint8Array([1, 2, 3, 4]))
    expect(b).toEqual(new Uint8Array([5, 6, 7, 8]))
  })

  test('checkSignaturePublicKey', async () => {
    const alice = sodium.crypto_sign_keypair()
    const eve = sodium.crypto_sign_keypair()
    expect(
      checkSignaturePublicKey(sodium, alice.publicKey, alice.privateKey)
    ).toBe(true)
    expect(
      checkSignaturePublicKey(sodium, eve.publicKey, alice.privateKey)
    ).toBe(false)
  })

  test('checkEncryptionPublicKey', async () => {
    const alice = sodium.crypto_box_keypair()
    const eve = sodium.crypto_box_keypair()
    expect(
      checkEncryptionPublicKey(sodium, alice.publicKey, alice.privateKey)
    ).toBe(true)
    expect(
      checkEncryptionPublicKey(sodium, eve.publicKey, alice.privateKey)
    ).toBe(false)
  })
})

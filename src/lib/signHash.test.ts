import { signHash, verifySignedHash } from './signHash'
import { ready, sodium } from './sodium'

beforeAll(() => ready)

describe('signHash', () => {
  test('known vectors', async () => {
    const publicKey = sodium.from_hex(
      '92aee3f6e0a40ad845bfc0ab02aadccd4ae6e8867b31bb02ac053299f6318f6b'
    )
    const a = sodium.from_hex('d1cd26bb39450181')
    const b = sodium.from_hex('80cc62c261b30c32')
    const c = sodium.from_hex('bfe93254c419de3c')
    const signature = sodium.from_hex(
      'fba20e44f67faee9bb69cb2a3f99a2753c90fad7d5b8e4f2081032e9911e689a838411dd98432f301ab5a6c99fd26855d7f4545c83644f6e8c90411b519d9a07'
    )
    const verified = verifySignedHash(sodium, publicKey, signature, a, b, c)
    expect(verified).toBe(true)
  })

  describe.each([
    {
      label: 8,
      getBlockLength: () => 8,
    },
    {
      label: 47,
      getBlockLength: () => 47,
    },
    {
      label: 'random size (8-64)',
      getBlockLength: () => Math.round(8 + 56 * Math.random()),
    },
  ])('blocks of $label bytes', ({ getBlockLength }) => {
    test('matching', async () => {
      const alice = sodium.crypto_sign_keypair()
      const a = sodium.randombytes_buf(getBlockLength())
      const b = sodium.randombytes_buf(getBlockLength())
      const c = sodium.randombytes_buf(getBlockLength())
      const signature = signHash(sodium, alice.privateKey, a, b, c)
      const verified = verifySignedHash(
        sodium,
        alice.publicKey,
        signature,
        a,
        b,
        c
      )
      expect(verified).toBe(true)
    })

    test('mismatching public key', async () => {
      const alice = sodium.crypto_sign_keypair()
      const eve = sodium.crypto_sign_keypair()
      const a = sodium.randombytes_buf(getBlockLength())
      const b = sodium.randombytes_buf(getBlockLength())
      const c = sodium.randombytes_buf(getBlockLength())
      const signature = signHash(sodium, alice.privateKey, a, b, c)
      const verified = verifySignedHash(
        sodium,
        eve.publicKey,
        signature,
        a,
        b,
        c
      )
      expect(verified).toBe(false)
    })

    test('mismatching private key', async () => {
      const alice = sodium.crypto_sign_keypair()
      const eve = sodium.crypto_sign_keypair()
      const a = sodium.randombytes_buf(getBlockLength())
      const b = sodium.randombytes_buf(getBlockLength())
      const c = sodium.randombytes_buf(getBlockLength())
      const signature = signHash(sodium, eve.privateKey, a, b, c)
      const verified = verifySignedHash(
        sodium,
        alice.publicKey,
        signature,
        a,
        b,
        c
      )
      expect(verified).toBe(false)
    })

    test('mismatching signature', async () => {
      const alice = sodium.crypto_sign_keypair()
      const a = sodium.randombytes_buf(getBlockLength())
      const b = sodium.randombytes_buf(getBlockLength())
      const c = sodium.randombytes_buf(getBlockLength())
      const signature = signHash(sodium, alice.privateKey, a, b, c)
      signature.sort()
      const verified = verifySignedHash(
        sodium,
        alice.publicKey,
        signature,
        a,
        b,
        c
      )
      expect(verified).toBe(false)
    })

    test('tampering with data', async () => {
      const alice = sodium.crypto_sign_keypair()
      const a = sodium.randombytes_buf(getBlockLength())
      const b = sodium.randombytes_buf(getBlockLength())
      const c = sodium.randombytes_buf(getBlockLength())
      const signature = signHash(sodium, alice.privateKey, a, b, c)
      const verified = verifySignedHash(
        sodium,
        alice.publicKey,
        signature,
        // Reordered data
        c,
        a,
        b
      )
      expect(verified).toBe(false)
    })
  })
})

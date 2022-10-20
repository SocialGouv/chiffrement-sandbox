// @ts-check

import sodium from 'libsodium-wrappers'
import { bench, group, run } from 'mitata'
import tweetNaCl from 'tweetnacl'

async function runBenchmark() {
  await sodium.ready

  // Utilities --

  group('random bytes', () => {
    bench('sodium', () => sodium.randombytes_buf(32, 'uint8array'))
    bench('tweetnacl', () => tweetNaCl.randomBytes(32))
  })

  group('hash', () => {
    const message = sodium.from_string('Hello, world!')
    bench('sodium', () => sodium.crypto_hash(message, 'uint8array'))
    bench('tweetnacl', () => tweetNaCl.hash(message))
  })

  // Symmetric Key encryption --

  group('secretbox.encrypt', () => {
    const message = sodium.from_string('Hello, world!')
    const key = tweetNaCl.randomBytes(tweetNaCl.secretbox.keyLength)
    const nonce = tweetNaCl.randomBytes(tweetNaCl.secretbox.nonceLength)
    bench('sodium', () =>
      sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        message,
        null,
        null,
        nonce,
        key,
        'uint8array'
      )
    )
    bench('tweetnacl', () => tweetNaCl.secretbox(message, nonce, key))
  })

  group('secretbox.decrypt', () => {
    const message = sodium.from_string('Hello, world!')
    const key = tweetNaCl.randomBytes(tweetNaCl.secretbox.keyLength)
    const nonce = tweetNaCl.randomBytes(tweetNaCl.secretbox.nonceLength)
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      message,
      null,
      null,
      nonce,
      key,
      'uint8array'
    )
    bench('sodium', () =>
      sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertext,
        null,
        nonce,
        key,
        'uint8array'
      )
    )
    bench('tweetnacl', () => tweetNaCl.secretbox.open(ciphertext, nonce, key))
  })

  // Public Key encryption --

  group('box.keypair', () => {
    bench('sodium', () => sodium.crypto_box_keypair('uint8array'))
    bench('tweetnacl', () => tweetNaCl.box.keyPair())
  })

  group('box.encrypt', () => {
    const alice = tweetNaCl.box.keyPair()
    const bob = tweetNaCl.box.keyPair()
    const nonce = tweetNaCl.randomBytes(tweetNaCl.box.nonceLength)
    const message = sodium.from_string('Hello, world!')
    bench('sodium', () =>
      sodium.crypto_box_easy(
        message,
        nonce,
        bob.publicKey,
        alice.secretKey,
        'uint8array'
      )
    )
    bench('tweetnacl', () =>
      tweetNaCl.box(message, nonce, bob.publicKey, alice.secretKey)
    )
  })

  group('box.decrypt', () => {
    const alice = tweetNaCl.box.keyPair()
    const bob = tweetNaCl.box.keyPair()
    const nonce = tweetNaCl.randomBytes(tweetNaCl.box.nonceLength)
    const message = sodium.from_string('Hello, world!')
    const ciphertext = tweetNaCl.box(
      message,
      nonce,
      bob.publicKey,
      alice.secretKey
    )
    bench('sodium', () =>
      sodium.crypto_box_open_easy(
        ciphertext,
        nonce,
        alice.publicKey,
        bob.secretKey,
        'uint8array'
      )
    )
    bench('tweetnacl', () =>
      tweetNaCl.box.open(ciphertext, nonce, alice.publicKey, bob.secretKey)
    )
  })

  group('sealedbox.encrypt', () => {
    const alice = tweetNaCl.box.keyPair()
    const message = sodium.from_string('Hello, world!')
    bench('sodium', () =>
      sodium.crypto_box_seal(message, alice.publicKey, 'uint8array')
    )
    bench('tweetnacl', () => {
      const nonce = tweetNaCl.randomBytes(tweetNaCl.box.nonceLength)
      const messageKeyPair = tweetNaCl.box.keyPair()
      tweetNaCl.box(message, nonce, alice.publicKey, messageKeyPair.secretKey)
    })
  })

  group('sealedbox.decrypt', () => {
    const alice = tweetNaCl.box.keyPair()
    const message = sodium.from_string('Hello, world!')
    const wasmMessage = sodium.crypto_box_seal(
      message,
      alice.publicKey,
      'uint8array'
    )
    const nonce = tweetNaCl.randomBytes(tweetNaCl.box.nonceLength)
    const messageKeyPair = tweetNaCl.box.keyPair()
    const jsMessage = tweetNaCl.box(
      message,
      nonce,
      alice.publicKey,
      messageKeyPair.secretKey
    )

    bench('sodium', () =>
      sodium.crypto_box_seal_open(
        wasmMessage,
        alice.publicKey,
        alice.secretKey,
        'uint8array'
      )
    )
    bench('tweetnacl', () => {
      tweetNaCl.box.open(
        jsMessage,
        nonce,
        messageKeyPair.publicKey,
        alice.secretKey
      )
    })
  })

  // Signature --

  group('sign.keypair', () => {
    bench('sodium', () => sodium.crypto_sign_keypair('uint8array'))
    bench('tweetnacl', () => tweetNaCl.sign.keyPair())
  })

  group('sign', () => {
    const alice = tweetNaCl.sign.keyPair()
    const message = sodium.from_string('Hello, world!')
    bench('sodium', () =>
      sodium.crypto_sign(message, alice.secretKey, 'uint8array')
    )
    bench('tweetnacl', () => tweetNaCl.sign(message, alice.secretKey))
  })

  group('sign.verify', () => {
    const alice = tweetNaCl.sign.keyPair()
    const message = sodium.from_string('Hello, world!')
    const sig = tweetNaCl.sign(message, alice.secretKey)
    bench('sodium', () =>
      sodium.crypto_sign_open(sig, alice.publicKey, 'uint8array')
    )
    bench('tweetnacl', () => tweetNaCl.sign.open(sig, alice.publicKey))
  })

  await run({
    colors: typeof window === 'undefined',
  })
}

runBenchmark()

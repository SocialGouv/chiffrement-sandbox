import { hash as blake2b } from '@stablelib/blake2b'
import tweetnacl from 'tweetnacl'

export function seal(input: Uint8Array, publicKey: Uint8Array) {
  const ephemeralKeyPair = tweetnacl.box.keyPair()

  // Compute nonce as blake2b(ephemeral_pubKey || recipient_pubKey)
  const nonceInput = new Uint8Array(2 * publicKey.byteLength)
  nonceInput.set(ephemeralKeyPair.publicKey)
  nonceInput.set(publicKey, ephemeralKeyPair.publicKey.byteLength)
  const nonce = blake2b(nonceInput, tweetnacl.box.nonceLength)

  const ciphertext = tweetnacl.box(
    input,
    nonce,
    publicKey,
    ephemeralKeyPair.secretKey
  )
  // Output is ephemeral_pubKey || ciphertext
  const out = new Uint8Array(
    ephemeralKeyPair.publicKey.byteLength + ciphertext.byteLength
  )
  out.set(ephemeralKeyPair.publicKey)
  out.set(ciphertext, ephemeralKeyPair.publicKey.byteLength)
  return out
}

import type { StringOutputFormat } from 'libsodium-wrappers'
import type { Sodium } from './sodium'

export function concat(...items: Uint8Array[]) {
  const buffer = new Uint8Array(
    items.reduce((sum, item) => sum + item.length, 0)
  )
  let index = 0
  items.forEach(item => {
    buffer.set(item, index)
    index += item.length
  })
  return buffer
}

export function split(buffer: Uint8Array, splitPoint: number) {
  const a = buffer.slice(0, splitPoint)
  const b = buffer.slice(splitPoint)
  return [a, b]
}

export function isUint8Array(input: any): input is Uint8Array {
  return typeof input?.byteLength === 'number'
}

export function isEncryptable(
  value: any
): value is Uint8Array | string | number | boolean {
  return (
    ['string', 'number', 'boolean'].includes(typeof value) ||
    isUint8Array(value)
  )
}

export function encode(
  sodium: Sodium,
  input: Uint8Array,
  format: StringOutputFormat
) {
  if (format === 'base64') {
    return sodium.to_base64(input)
  }
  if (format === 'hex') {
    return sodium.to_hex(input)
  }
  if (format === 'text') {
    return sodium.to_string(input)
  }
  throw new Error(`Unsupported encoding format ${format}`)
}

export function decode(
  sodium: Sodium,
  input: string,
  format: StringOutputFormat
) {
  if (format === 'base64') {
    return sodium.from_base64(input)
  }
  if (format === 'hex') {
    return sodium.from_hex(input)
  }
  if (format === 'text') {
    return sodium.from_string(input)
  }
  throw new Error(`Unsupported encoding format ${format}`)
}

/**
 * When receiving one of our own signature public keys from a server,
 * make sure it matches our associated private key.
 *
 * We could theoretically derive the public key from the private key,
 * but this uses functions not available in the standard libsodium-wrappers
 * library (available in the Sumo version).
 * Since servers usually need public keys to distribute them, we can ask it
 * to send it back to us, and we use this method to verify they match,
 * by signing a random buffer and verifying it.
 *
 * Works on Sodium signature key pairs generated with `sodium.crypto_sign_keypair()`
 *
 * @param publicKey The public key received from the outside
 * @param privateKey The associated private key
 */
export function checkSignaturePublicKey(
  sodium: Sodium,
  publicKey: Uint8Array,
  privateKey: Uint8Array
) {
  const randomBuffer = sodium.randombytes_buf(32)
  const signature = sodium.crypto_sign_detached(randomBuffer, privateKey)
  return sodium.crypto_sign_verify_detached(signature, randomBuffer, publicKey)
}

/**
 * When receiving one of our own encryption public keys from a server,
 * make sure it matches our associated private key.
 *
 * Works on Sodium box key pairs generated with `sodium.crypto_box_keypair()`.
 *
 * @param publicKey The public key received from the outside
 * @param privateKey The associated private key
 */
export function checkEncryptionPublicKey(
  sodium: Sodium,
  publicKey: Uint8Array,
  privateKey: Uint8Array
) {
  const derivedPublicKey = sodium.crypto_scalarmult_base(privateKey)
  return sodium.compare(derivedPublicKey, publicKey) === 0
}

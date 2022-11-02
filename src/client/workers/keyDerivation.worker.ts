import { expose } from 'comlink'
import sodium from 'libsodium-wrappers'

export type WorkerType = typeof keyDerivation

async function keyDerivation(
  keySize: number,
  input: string,
  salt: string,
  complexity: number,
  memorySize: number,
  algorithm: number
) {
  performance.mark('key-derivation:worker:start', {
    detail: {
      keySize,
      input,
      salt,
      complexity,
      memorySize,
      algorithm,
    },
  })
  await sodium.ready
  performance.mark('key-derivation:worker:sodiumReady')
  const saltBuffer = sodium.from_hex(salt)
  performance.mark('key-derivation:worker:saltDecoded')
  const key = sodium.crypto_pwhash(
    keySize,
    input,
    saltBuffer,
    complexity,
    memorySize,
    algorithm,
    'base64'
  )
  performance.mark('key-derivation:worker:done')
  performance.measure(
    'key-derivation:worker',
    `key-derivation:worker:start`,
    `key-derivation:worker:done`
  )
  return key
}

expose(keyDerivation)

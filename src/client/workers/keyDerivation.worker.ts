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
  const tick = performance.now()
  await sodium.ready

  console.dir({
    OPSLIMIT_SENSITIVE: sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
    mem: sodium.crypto_pwhash_MEMLIMIT_MODERATE / 1024,
    memorySize,
  })

  const saltBuffer = sodium.from_hex(salt)
  const tack = performance.now()
  const key = sodium.crypto_pwhash(
    keySize,
    input,
    saltBuffer,
    complexity,
    memorySize,
    algorithm,
    'base64'
  )
  const tock = performance.now()
  console.dir({
    'sodium getting ready': tack - tick,
    'key derivation': tock - tack,
    total: tock - tick,
  })
  return key
}

expose(keyDerivation)

import libsodium from 'libsodium-wrappers'

export type Sodium = typeof libsodium

export async function initializeSodium(): Promise<Sodium> {
  await libsodium.ready
  return libsodium
}

export class SodiumInterface {
  protected sodium: Sodium

  constructor(sodium: Sodium) {
    this.sodium = sodium
  }
}

import libsodium from 'libsodium-wrappers'

export type Sodium = typeof libsodium

export let sodium: Sodium

export const ready = libsodium.ready

export async function initializeSodium() {
  await libsodium.ready
  sodium = libsodium
  return sodium
}

initializeSodium()

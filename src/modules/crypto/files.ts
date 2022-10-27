import { Sodium } from './sodium.js'

export const DEFAULT_FILE_CHUNK_SIZE = 4096

export function generateFileEncryptionKey(sodium: Sodium) {
  return sodium.crypto_secretstream_xchacha20poly1305_keygen()
}

export async function encryptFile(
  sodium: Sodium,
  file: Blob,
  key: Uint8Array,
  chunkSize = DEFAULT_FILE_CHUNK_SIZE
) {
  const numChunks = Math.ceil(file.size / chunkSize)
  const ciphertextLength =
    sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES +
    file.size +
    sodium.crypto_secretstream_xchacha20poly1305_ABYTES * numChunks
  const ciphertextBuffer = new Uint8Array(ciphertextLength)
  const { header, state } =
    sodium.crypto_secretstream_xchacha20poly1305_init_push(key)
  ciphertextBuffer.set(header)
  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const tag =
      chunkIndex === numChunks - 1
        ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
        : 0
    const ciphertext = sodium.crypto_secretstream_xchacha20poly1305_push(
      state,
      new Uint8Array(
        await file
          .slice(chunkSize * chunkIndex, chunkSize * (chunkIndex + 1))
          .arrayBuffer()
      ),
      null, // No additional data
      tag
    )
    ciphertextBuffer.set(
      ciphertext,
      header.byteLength +
        chunkIndex *
          (chunkSize + sodium.crypto_secretstream_xchacha20poly1305_ABYTES)
    )
  }
  return {
    chunkSize,
    ciphertext: ciphertextBuffer,
  }
}

export function decryptFile(
  sodium: Sodium,
  ciphertext: Uint8Array,
  key: Uint8Array,
  chunkSize = DEFAULT_FILE_CHUNK_SIZE
) {
  const ciphertextChunkSize =
    chunkSize + sodium.crypto_secretstream_xchacha20poly1305_ABYTES
  const numChunks = Math.ceil(
    (ciphertext.byteLength -
      sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES) /
      ciphertextChunkSize
  )
  const clearTextSize =
    ciphertext.byteLength -
    sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES -
    numChunks * sodium.crypto_secretstream_xchacha20poly1305_ABYTES
  const clearTextBuffer = new Uint8Array(clearTextSize)
  const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(
    ciphertext.slice(
      0,
      sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES
    ),
    key
  )
  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const start =
      sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES +
      chunkIndex * ciphertextChunkSize
    const end = start + ciphertextChunkSize
    const ciphertextSlice = ciphertext.slice(start, end)
    const clearText = sodium.crypto_secretstream_xchacha20poly1305_pull(
      state,
      ciphertextSlice
    )
    if (!clearText.message) {
      throw new Error('Failed to decrypt file')
    }
    clearTextBuffer.set(clearText.message, chunkIndex * chunkSize)
  }
  return clearTextBuffer
}

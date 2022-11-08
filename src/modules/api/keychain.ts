import { z } from 'zod'

const keychainItem = z.object({
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  name: z.string(),
  payload: z.string(),
  nameFingerprint: z.string(),
  payloadFingerprint: z.string(),
  ownerId: z.string(),
  sharedBy: z.string().nullable(),
  signature: z.string(),
})

export const postKeychainItemRequestBody = keychainItem
export type PostKeychainItemRequestBody = z.infer<typeof keychainItem>

export const getKeychainResponseBody = z.array(keychainItem)
export type GetKeychainResponseBody = z.infer<typeof getKeychainResponseBody>

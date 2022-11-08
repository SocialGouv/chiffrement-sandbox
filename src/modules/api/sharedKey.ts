import { z } from 'zod'

const sharedKey = z.object({
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  toUserId: z.string(),
  fromUserId: z.string(),
  fromSharingPublicKey: z.string(),
  fromSignaturePublicKey: z.string(),
  name: z.string(),
  payload: z.string(),
  nameFingerprint: z.string(),
  payloadFingerprint: z.string(),
  signature: z.string(),
})

// --

export const postSharedKeyBody = sharedKey
export type PostSharedKeyBody = z.infer<typeof postSharedKeyBody>

export const getSharedKeysResponseBody = z.array(sharedKey)
export type GetSharedKeysResponseBody = z.infer<
  typeof getSharedKeysResponseBody
>

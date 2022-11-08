import { z } from 'zod'

export const postBanRequestBody = z.object({
  userId: z.string().min(1),
  nameFingerprint: z.string().min(1),
})

export type PostBanRequestBody = z.infer<typeof postBanRequestBody>

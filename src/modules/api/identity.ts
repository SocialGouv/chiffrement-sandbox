import { z } from 'zod'

export const getSingleIdentityResponseBody = z.object({
  userId: z.string(),
  sharingPublicKey: z.string(),
  signaturePublicKey: z.string(),
})
export type GetSingleIdentityResponseBody = z.infer<
  typeof getSingleIdentityResponseBody
>

export const getMultipleIdentitiesResponseBody = z.array(
  getSingleIdentityResponseBody
)
export type GetMultipleIdentitiesResponseBody = z.infer<
  typeof getMultipleIdentitiesResponseBody
>

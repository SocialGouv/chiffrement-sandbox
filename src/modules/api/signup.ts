import { z } from 'zod'

export const signupRequestBody = z.object({
  userID: z.string(),
  signaturePublicKey: z.string(),
  signaturePrivateKey: z.string(),
  sharingPublicKey: z.string(),
  sharingPrivateKey: z.string(),
})

export type SignupRequestBody = z.TypeOf<typeof signupRequestBody>

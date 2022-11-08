import { z } from 'zod'
import { signupRequestBody } from './signup.js'

export const loginResponseBody = signupRequestBody.pick({
  signaturePublicKey: true,
  signaturePrivateKey: true,
  sharingPublicKey: true,
  sharingPrivateKey: true,
})

export type LoginResponseBody = z.infer<typeof loginResponseBody>

import { z } from 'zod'

export const publicRouteHeaders = z.object({
  'x-e2esdk-user-id': z.string(),
  'x-e2esdk-timestamp': z.string(),
})

export const publicKeyAuthHeaders = publicRouteHeaders.extend({
  'x-e2esdk-signature': z.string(),
})

// --

export type PublicRouteHeaders = z.infer<typeof publicRouteHeaders>
export type PublicKeyAuthHeaders = z.infer<typeof publicKeyAuthHeaders>

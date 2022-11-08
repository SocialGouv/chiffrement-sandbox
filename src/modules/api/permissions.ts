import { z } from 'zod'

export const permissionFlags = z.object({
  allowSharing: z.boolean(),
  allowRotation: z.boolean(),
  allowDeletion: z.boolean(),
  allowManagement: z.boolean(),
})

export type PermissionFlags = z.infer<typeof permissionFlags>

export const postPermissionRequestBody = permissionFlags.partial().extend({
  userId: z.string().min(1),
  nameFingerprint: z.string().min(1),
})

export type PostPermissionRequestBody = z.infer<
  typeof postPermissionRequestBody
>

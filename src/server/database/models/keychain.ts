import type { Sql } from 'postgres'
import { z } from 'zod'

export const TABLE_NAME = 'e2esdk_keychain_items'

export const keychainItemSchema = z.object({
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

export type KeychainItemSchema = z.TypeOf<typeof keychainItemSchema>

export function storeKeychainItem(sql: Sql, item: KeychainItemSchema) {
  return sql`INSERT INTO ${sql(TABLE_NAME)} ${sql(item)}`
}

export function getOwnKeychainItems(
  sql: Sql,
  userId: string
): Promise<KeychainItemSchema[]> {
  return sql`
    SELECT *
    FROM ${sql(TABLE_NAME)}
    WHERE ${sql('ownerId')} = ${userId}
  `
}

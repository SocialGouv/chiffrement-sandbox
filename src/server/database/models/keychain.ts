import type { Sql } from 'postgres'
import { z } from 'zod'
import { getFirst } from './helpers.js'

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

export async function getKeychainItem(
  sql: Sql,
  {
    ownerId,
    nameFingerprint,
    payloadFingerprint,
  }: Pick<
    KeychainItemSchema,
    'ownerId' | 'nameFingerprint' | 'payloadFingerprint'
  >
) {
  const results: KeychainItemSchema[] = await sql`
    SELECT *
    FROM ${sql(TABLE_NAME)}
    WHERE ${sql('ownerId')} = ${ownerId}
    -- Keep payloadFingerprint first for index performance
    AND ${sql('payloadFingerprint')} = ${payloadFingerprint}
    AND ${sql('nameFingerprint')} = ${nameFingerprint}
  `
  return getFirst(results)
}

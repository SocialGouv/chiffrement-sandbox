import type { Sql } from 'postgres'
import { z } from 'zod'
import { getFirst } from '../helpers.js'

export const TABLE_NAME = 'e2esdk_identities'

export const identitySchema = z.object({
  userID: z.string(),
  signaturePublicKey: z.string(),
  signaturePrivateKey: z.string(),
  sharingPublicKey: z.string(),
  sharingPrivateKey: z.string(),
})

export type IdentitySchema = z.TypeOf<typeof identitySchema>

export function createIdentity(
  sql: Sql,
  identity: Omit<IdentitySchema, 'createdAt'>
) {
  return sql`INSERT INTO ${TABLE_NAME} ${sql(identity)}`
}

export async function getOwnIdentity(sql: Sql, userID: string) {
  const columns = [
    'sharingPublicKey',
    'sharingPrivateKey',
    'signaturePublicKey',
    'signaturePrivateKey',
  ] as const
  type Row = Pick<IdentitySchema, typeof columns[number]>
  const result: Row[] = await sql`
    SELECT ${columns} FROM ${TABLE_NAME} WHERE user_id = ${userID} LIMIT 1
  `
  return getFirst(result)
}

export async function getPublicIdentity(sql: Sql, userID: string) {
  const columns = ['userID', 'sharingPublicKey', 'signaturePublicKey'] as const
  type Row = Pick<IdentitySchema, typeof columns[number]>
  const result: Row[] = await sql`
    SELECT ${columns} FROM ${TABLE_NAME} WHERE user_id = ${userID} LIMIT 1
  `
  return getFirst(result)
}

export function getPublicIdentities(sql: Sql, userIDs: string[]) {
  const columns = ['userID', 'sharingPublicKey', 'signaturePublicKey'] as const
  type Row = Pick<IdentitySchema, typeof columns[number]>
  return sql<Row[]>`
    SELECT ${columns} FROM ${TABLE_NAME} WHERE user_id in ${sql(userIDs)}
  `
}

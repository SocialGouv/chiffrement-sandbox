// @ts-check

import { SEED_USERS } from './seeds/identities.mjs'

/**
 * @param {import('postgres').Sql} sql
 */
export async function apply(sql) {
  const identities = SEED_USERS.map(user => user.identity)
  await sql`INSERT INTO e2esdk_identities ${sql(identities)}`
}

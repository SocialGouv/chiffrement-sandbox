import type { Sql } from 'postgres'
import { z } from 'zod'
import type { Optional } from '../../../modules/types.js'
import { getFirst } from './helpers.js'

export const TABLE_NAME = 'e2esdk_permissions'

export const permissionSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
  nameFingerprint: z.string(),
  allowSharing: z.boolean(),
  allowRotation: z.boolean(),
  allowDeletion: z.boolean(),
  allowManagement: z.boolean(),
})

export type PermissionSchema = z.TypeOf<typeof permissionSchema>

// --

const permissionFlags = permissionSchema.pick({
  allowSharing: true,
  allowRotation: true,
  allowDeletion: true,
  allowManagement: true,
})

type PermissionFlags = z.infer<typeof permissionFlags>

// --

export function createPermission(
  sql: Sql,
  item: Omit<PermissionSchema, 'createdAt' | 'updatedAt'>
) {
  const input: Optional<PermissionSchema, 'createdAt' | 'updatedAt'> = item
  delete input.createdAt
  delete input.updatedAt
  return sql`INSERT INTO ${sql(TABLE_NAME)} ${sql(input)}`
}

export async function getPermission(
  sql: Sql,
  userId: string,
  nameFingerprint: string
): Promise<PermissionFlags> {
  const results: PermissionFlags[] = await sql`
    SELECT ${sql(permissionFlags.keyof().options)}
    FROM   ${sql(TABLE_NAME)}
    WHERE  ${sql('userId')}          = ${userId}
    AND    ${sql('nameFingerprint')} = ${nameFingerprint}
  `
  const result = getFirst(results)
  return (
    result ?? {
      allowDeletion: false,
      allowManagement: false,
      allowRotation: false,
      allowSharing: false,
    }
  )
}

export function updatePermission(
  sql: Sql,
  {
    userId,
    nameFingerprint,
    ...input
  }: Pick<PermissionSchema, 'userId' | 'nameFingerprint'> &
    Partial<
      Pick<
        PermissionSchema,
        'allowSharing' | 'allowRotation' | 'allowDeletion' | 'allowManagement'
      >
    >
) {
  const columnsToUpdate = (
    [
      'allowSharing',
      'allowRotation',
      'allowDeletion',
      'allowManagement',
    ] as const
  )
    .filter(columnName => input[columnName] !== undefined)
    .map(columnName => sql(columnName))
  return sql`
    UPDATE FROM ${sql(TABLE_NAME)}
    SET   ${sql(input, ...(columnsToUpdate as any))}
    WHERE ${sql('userId')}          = ${userId}
    AND   ${sql('nameFingerprint')} = ${nameFingerprint}
  `
}

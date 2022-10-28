import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  getPublicIdentities,
  getPublicIdentity,
  identitySchema,
} from '../database/models/identity.js'
import type { App } from '../types.js'

const userIdParams = z.object({
  userId: z.string(),
})

const userIdsParams = z.object({
  userIds: z.string(),
})

const singleIdentityResponseBody = identitySchema.pick({
  userId: true,
  sharingPublicKey: true,
  signaturePublicKey: true,
})

const multipleIdentitiesResponseBody = z.array(singleIdentityResponseBody)

export default async function identitiesRoutes(app: App) {
  app.get<{
    Params: z.TypeOf<typeof userIdParams>
    Reply: z.TypeOf<typeof singleIdentityResponseBody>
  }>(
    '/identity/:userId',
    {
      schema: {
        response: {
          200: zodToJsonSchema(singleIdentityResponseBody),
        },
      },
    },
    async function getSinglePublicIdentity(req, res) {
      const identity = await getPublicIdentity(app.db, req.params.userId)
      if (!identity) {
        throw app.httpErrors.notFound(
          `No identity found for user id ${req.params.userId}`
        )
      }
      return res.send(identity)
    }
  )
  app.get<{
    Params: z.TypeOf<typeof userIdsParams>
    Reply: z.TypeOf<typeof multipleIdentitiesResponseBody>
  }>(
    '/identities/:userIds',
    {
      schema: {
        params: zodToJsonSchema(userIdsParams),
        response: {
          200: zodToJsonSchema(multipleIdentitiesResponseBody),
        },
      },
    },
    async function getMultiplePublicIdentities(req, res) {
      const userIds = req.params.userIds.split(',')
      const identities = await getPublicIdentities(app.db, userIds)
      return res.send(identities)
    }
  )
}

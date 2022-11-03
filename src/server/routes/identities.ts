import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  publicKeyAuthHeaders,
  PublicKeyAuthHeaders,
} from '../../modules/api/headers.js'
import {
  getMultipleIdentitiesResponseBody,
  GetMultipleIdentitiesResponseBody,
  getSingleIdentityResponseBody,
  GetSingleIdentityResponseBody,
} from '../../modules/api/identity.js'
import {
  getPublicIdentities,
  getPublicIdentity,
} from '../database/models/identity.js'
import type { App } from '../types.js'

const userIdParams = z.object({
  userId: z.string(),
})

const userIdsParams = z.object({
  userIds: z.string(),
})

export default async function identitiesRoutes(app: App) {
  app.get<{
    Params: z.TypeOf<typeof userIdParams>
    Headers: PublicKeyAuthHeaders
    Reply: GetSingleIdentityResponseBody
  }>(
    '/identity/:userId',
    {
      preValidation: app.usePublicKeyAuth(),
      schema: {
        params: zodToJsonSchema(userIdParams),
        headers: zodToJsonSchema(publicKeyAuthHeaders),
        response: {
          200: zodToJsonSchema(getSingleIdentityResponseBody),
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
    Reply: GetMultipleIdentitiesResponseBody
  }>(
    '/identities/:userIds',
    {
      preValidation: app.usePublicKeyAuth(),
      schema: {
        params: zodToJsonSchema(userIdsParams),
        headers: zodToJsonSchema(publicKeyAuthHeaders),
        response: {
          200: zodToJsonSchema(getMultipleIdentitiesResponseBody),
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

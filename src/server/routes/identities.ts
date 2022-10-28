import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  getPublicIdentities,
  getPublicIdentity,
  identitySchema,
} from '../database/models/identity.js'
import type { App } from '../types.js'

const userIDParams = z.object({
  userID: z.string(),
})

const userIDsParams = z.object({
  userIDs: z.string(),
})

const singleIdentityResponseBody = identitySchema.pick({
  userID: true,
  sharingPublicKey: true,
  signaturePublicKey: true,
})

const multipleIdentitiesResponseBody = z.array(singleIdentityResponseBody)

export default async function identitiesRoutes(app: App) {
  app.get<{
    Params: z.TypeOf<typeof userIDParams>
    Reply: z.TypeOf<typeof singleIdentityResponseBody>
  }>(
    '/identity/:userID',
    {
      schema: {
        response: {
          200: zodToJsonSchema(singleIdentityResponseBody),
        },
      },
    },
    async function getSinglePublicIdentity(req, res) {
      const identity = await getPublicIdentity(app.db, req.params.userID)
      if (!identity) {
        throw app.httpErrors.notFound(
          `No identity found for user id ${req.params.userID}`
        )
      }
      return res.send(identity)
    }
  )
  app.get<{
    Params: z.TypeOf<typeof userIDsParams>
    Reply: z.TypeOf<typeof multipleIdentitiesResponseBody>
  }>(
    '/identities/:userIDs',
    {
      schema: {
        params: zodToJsonSchema(userIDsParams),
        response: {
          200: zodToJsonSchema(multipleIdentitiesResponseBody),
        },
      },
    },
    async function getMultiplePublicIdentities(req, res) {
      const userIDs = req.params.userIDs.split(',')
      const identities = await getPublicIdentities(app.db, userIDs)
      return res.send(identities)
    }
  )
}

import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  PublicKeyAuthHeaders,
  publicKeyAuthHeaders,
} from '../../modules/api/headers.js'
import {
  getSharedKeysResponseBody,
  GetSharedKeysResponseBody,
  postSharedKeyBody,
  PostSharedKeyBody,
} from '../../modules/api/sharedKey.js'
import {
  getKeysSharedByMe,
  getKeysSharedWithMe,
  storeSharedKey,
} from '../database/models/sharedKey.js'
import type { App } from '../types.js'

export default async function sharedKeysRoutes(app: App) {
  app.post<{
    Headers: PublicKeyAuthHeaders
    Body: PostSharedKeyBody
  }>(
    '/shared-keys',
    {
      preValidation: app.usePublicKeyAuth(),
      schema: {
        headers: zodToJsonSchema(publicKeyAuthHeaders),
        body: zodToJsonSchema(postSharedKeyBody),
        response: {
          201: {
            type: 'null',
          },
        },
      },
    },
    async function postSharedKey(req, res) {
      await storeSharedKey(app.db, req.body)
      return res.status(201)
    }
  )

  app.get<{
    Headers: PublicKeyAuthHeaders
    Reply: GetSharedKeysResponseBody
  }>(
    '/shared-keys/incoming',
    {
      preValidation: app.usePublicKeyAuth(),
      schema: {
        headers: zodToJsonSchema(publicKeyAuthHeaders),
        response: {
          200: zodToJsonSchema(getSharedKeysResponseBody),
        },
      },
    },
    async function getIncomingSharedKeys(req, res) {
      const sharedKeys = await getKeysSharedWithMe(app.db, req.identity.userId)
      return res.send(sharedKeys)
    }
  )

  app.get<{
    Headers: PublicKeyAuthHeaders
    Reply: GetSharedKeysResponseBody
  }>(
    '/shared-keys/outgoing',
    {
      preValidation: app.usePublicKeyAuth(),
      schema: {
        headers: zodToJsonSchema(publicKeyAuthHeaders),
        response: {
          200: zodToJsonSchema(getSharedKeysResponseBody),
        },
      },
    },
    async function getOutgoingSharedKeys(req, res) {
      const sharedKeys = await getKeysSharedByMe(app.db, req.identity)
      return res.send(sharedKeys)
    }
  )
}

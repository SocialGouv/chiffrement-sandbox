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
import { getKeychainItem } from '../database/models/keychain.js'
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
      // First, check if the recipient doesn't
      // already have this key in their keychain
      const existingKeychainEntry = await getKeychainItem(app.db, {
        ownerId: req.body.toUserId,
        nameFingerprint: req.body.nameFingerprint,
        payloadFingerprint: req.body.payloadFingerprint,
      })
      if (existingKeychainEntry) {
        throw app.httpErrors.conflict(
          'The recipient already has a copy of this key'
        )
      }
      await storeSharedKey(app.db, req.body)
      return res.status(201).send()
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

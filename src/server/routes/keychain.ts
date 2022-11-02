import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  publicKeyAuthHeaders,
  PublicKeyAuthHeaders,
} from '../../modules/api/headers.js'
import {
  GetKeychainResponseBody,
  getKeychainResponseBody,
  postKeychainItemRequestBody,
  PostKeychainItemRequestBody,
} from '../../modules/api/keychain.js'
import { verifySignedHash } from '../../modules/crypto/signHash.js'
import {
  getOwnKeychainItems,
  storeKeychainItem,
} from '../database/models/keychain.js'
import {
  deleteSharedKey,
  findSharedKey,
  SharedKeySchema,
} from '../database/models/sharedKey.js'
import type { App } from '../types.js'

export default async function keychainRoutes(app: App) {
  app.post<{
    Headers: PublicKeyAuthHeaders
    Body: PostKeychainItemRequestBody
  }>(
    '/keychain',
    {
      preValidation: app.usePublicKeyAuth(),
      schema: {
        headers: zodToJsonSchema(publicKeyAuthHeaders),
        body: zodToJsonSchema(postKeychainItemRequestBody),
        response: {
          201: {
            type: 'null',
          },
        },
      },
    },
    async function postKeychainItem(req, res) {
      function forbidden(msg: string, sharedKey?: SharedKeySchema): never {
        req.log.warn({
          msg,
          identity: req.identity,
          body: req.body,
          sharedKey,
        })
        throw app.httpErrors.forbidden(msg)
      }

      if (req.identity.userId !== req.body.ownerId) {
        forbidden("You cannot add keychain keys that don't belong to you")
      }
      if (
        !verifySignedHash(
          app.sodium,
          app.sodium.from_base64(req.identity.signaturePublicKey),
          app.sodium.from_base64(req.body.signature),
          app.sodium.from_string(req.identity.userId),
          app.sodium.from_string(req.body.sharedBy ?? ''),
          app.sodium.from_string(req.body.createdAt),
          app.sodium.from_string(req.body.expiresAt ?? ''),
          app.sodium.from_base64(req.body.nameFingerprint),
          app.sodium.from_base64(req.body.payloadFingerprint)
        )
      ) {
        forbidden('Invalid key signature')
      }

      if (!req.body.sharedBy) {
        await storeKeychainItem(app.db, req.body)
        return res.status(201)
      }

      const sharedKey = await findSharedKey(
        app.db,
        req.body.sharedBy,
        req.identity.userId,
        req.body.payloadFingerprint
      )
      if (
        !sharedKey ||
        sharedKey.fromUserId !== req.body.sharedBy ||
        sharedKey.toUserId !== req.identity.userId
      ) {
        forbidden('Could not find associated shared key')
      }
      for (const fieldToMatch of [
        'createdAt',
        'expiresAt',
        'nameFingerprint',
        'payloadFingerprint',
      ] as const) {
        if (sharedKey[fieldToMatch] !== req.body[fieldToMatch]) {
          forbidden(
            `Mismatching field ${fieldToMatch} with shared key`,
            sharedKey
          )
        }
      }
      await app.db.begin(
        async function storeKeychainItemAndDeleteSharedKeyTransaction(tx) {
          await storeKeychainItem(tx, req.body)
          await deleteSharedKey(
            tx,
            req.body.sharedBy!,
            req.identity.userId,
            req.body.payloadFingerprint
          )
        }
      )
      return res.status(201)
    }
  )

  app.get<{
    Headers: PublicKeyAuthHeaders
    Reply: GetKeychainResponseBody
  }>(
    '/keychain',
    {
      preValidation: app.usePublicKeyAuth(),
      schema: {
        headers: zodToJsonSchema(publicKeyAuthHeaders),
        response: {
          200: zodToJsonSchema(getKeychainResponseBody),
        },
      },
    },
    async function getKeychain(req, res) {
      const items = await getOwnKeychainItems(app.db, req.identity.userId)
      return res.send(items)
    }
  )
}

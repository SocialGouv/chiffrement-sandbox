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
  getKeyNameParticipants,
  getOwnKeychainItems,
  storeKeychainItem,
} from '../database/models/keychain.js'
import {
  createPermission,
  getPermission,
} from '../database/models/permissions.js'
import { deleteSharedKey, findSharedKey } from '../database/models/sharedKey.js'
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
      function forbidden(msg: string, extra?: any): never {
        req.log.warn({
          msg,
          identity: req.identity,
          body: req.body,
          ...extra,
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
        const participants = await getKeyNameParticipants(
          app.db,
          req.body.nameFingerprint
        )
        const isKeyAuthor = participants.length === 0
        if (
          !isKeyAuthor &&
          participants.every(
            participant => participant.ownerId !== req.identity.userId
          )
        ) {
          // User is trying to add a key that already has participants,
          // but user themselves are not in it, and they haven't specified
          // where the key came from.
          forbidden('You are not allowed to add this key', {
            participants,
          })
        }
        const { allowRotation } = await getPermission(
          app.db,
          req.identity.userId,
          req.body.nameFingerprint
        )
        const isRotation =
          !isKeyAuthor &&
          participants.every(
            key => key.payloadFingerprint !== req.body.payloadFingerprint
          )
        if (isRotation && !allowRotation) {
          forbidden('You are not allowed to rotate this key', { participants })
        }
        // Note: rotating back to an old key is prevented by the use of
        // a compound primary key encompassing (userId, payload_fingerprint).
        await app.db.begin(async tx => {
          if (isKeyAuthor) {
            await createPermission(tx, {
              userId: req.identity.userId,
              nameFingerprint: req.body.nameFingerprint,
              allowManagement: true,
              allowRotation: true,
              allowDeletion: true,
              allowSharing: true,
            })
          }
          await storeKeychainItem(tx, req.body)
        })
        return res.status(201).send()
      }

      // If the origin of the key is specified,
      // make sure it matches a shared key entry.

      const sharedKey = await findSharedKey(
        app.db,
        req.body.sharedBy,
        req.identity.userId,
        req.body.payloadFingerprint
      )
      if (!sharedKey) {
        forbidden('Could not find associated shared key')
      }
      for (const fieldToMatch of [
        'createdAt',
        'expiresAt',
        'nameFingerprint',
        'payloadFingerprint',
      ] as const) {
        if (sharedKey[fieldToMatch] !== req.body[fieldToMatch]) {
          forbidden(`Mismatching field ${fieldToMatch} with shared key`, {
            sharedKey,
          })
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
      return res.status(201).send()
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

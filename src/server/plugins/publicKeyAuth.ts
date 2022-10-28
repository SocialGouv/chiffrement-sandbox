import '@fastify/sensible'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import type { PublicUserIdentity } from '../../modules/crypto/client.js'
import { signHash, verifySignedHash } from '../../modules/crypto/signHash.js'
import type { Optional } from '../../modules/types'
import { getPublicIdentity } from '../database/models/identity.js'
import type { App } from '../types.js'

type PublicKeyAuthOptions = {
  publicRoute?: boolean
}

declare module 'fastify' {
  interface FastifyInstance {
    publicKeyAuth: (
      options?: PublicKeyAuthOptions
    ) => (req: FastifyRequest, res: FastifyReply) => Promise<any>
  }

  interface FastifyRequest {
    identity: Optional<
      PublicUserIdentity<string>,
      'signaturePublicKey' | 'sharingPublicKey'
    >
  }
}

const publicKeyAuthPlugin: FastifyPluginAsync = async (app: App) => {
  const serverSignaturePrivateKey = app.sodium.from_base64(
    process.env.SIGNATURE_PRIVATE_KEY!
  )

  app.decorate(
    'publicKeyAuth',
    ({ publicRoute = false }: PublicKeyAuthOptions = {}) =>
      async function publicKeyAuth(req: FastifyRequest) {
        const userID = req.headers['x-e2esdk-user-id'] as string
        if (!userID) {
          throw app.httpErrors.badRequest('Missing x-e2esdk-user-id header')
        }
        const timestampHeader = req.headers['x-e2esdk-timestamp'] as string
        if (!timestampHeader) {
          throw app.httpErrors.badRequest('Missing x-e2esdk-timestamp header')
        }
        if (Math.abs(parseInt(timestampHeader) - Date.now()) > 15 * 60 * 1000) {
          throw app.httpErrors.forbidden(
            'Request timestamp is too far off current time'
          )
        }
        if (publicRoute) {
          req.identity = {
            userID,
          }
          return
        }
        const signature = req.headers['x-e2esdk-signature'] as string
        if (!signature) {
          throw app.httpErrors.unauthorized('Missing x-e2esdk-signature header')
        }
        const identity = await getPublicIdentity(app.db, userID)
        if (!identity) {
          throw app.httpErrors.unauthorized(
            `No identity found for user ID ${userID}`
          )
        }
        try {
          if (
            !verifySignedHash(
              app.sodium,
              app.sodium.from_base64(identity.signaturePublicKey),
              app.sodium.from_base64(signature)
              // todo: Add signature elements
            )
          ) {
            throw new Error()
          }
        } catch {
          throw app.httpErrors.unauthorized('Invalid request signature')
        }
        req.identity = {
          userID,
          sharingPublicKey: identity.sharingPublicKey,
          signaturePublicKey: identity.signaturePublicKey,
        }
      }
  )

  app.addHook(
    'onSend',
    async function signServerResponse(req, res, body: string) {
      const timestamp = Date.now().toFixed()
      const signature = signHash(
        app.sodium,
        serverSignaturePrivateKey,
        ...([
          req.identity ? app.sodium.from_string(req.identity.userID) : null,
          app.sodium.from_string(
            `${req.method} ${process.env.DEPLOYMENT_URL}${req.url}`
          ),
          app.sodium.from_string(timestamp),
          body ? app.sodium.from_string(body) : null,
          // todo: Should this include the server public key?
          req.identity?.signaturePublicKey,
        ].filter(Boolean) as Uint8Array[])
      )
      if (req.identity) {
        res.header('x-e2esdk-user-id', req.identity.userID)
      }
      res.header('x-e2esdk-timestamp', timestamp)
      res.header('x-e2esdk-signature', app.sodium.to_base64(signature))
      res.header('x-e2esdk-server-pubkey', process.env.SIGNATURE_PUBLIC_KEY)
      return body
    }
  )
}

export default fp(publicKeyAuthPlugin, {
  fastify: '4.x',
  name: 'publicKeyAuth',
  dependencies: ['sodium', 'database'],
  decorators: {
    fastify: ['sodium', 'db'],
  },
})

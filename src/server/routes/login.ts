import { getOwnIdentity } from 'server/database/models/identity.js'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  PublicKeyAuthHeaders,
  publicKeyAuthHeaders,
} from '../../modules/api/headers.js'
import {
  loginResponseBody,
  LoginResponseBody,
} from '../../modules/api/login.js'
import { App } from '../types'

export default async function loginRoutes(app: App) {
  app.get<{
    Headers: PublicKeyAuthHeaders
    Reply: LoginResponseBody
  }>(
    '/login',
    {
      preValidation: [app.publicKeyAuth()],
      schema: {
        headers: zodToJsonSchema(publicKeyAuthHeaders),
        response: {
          200: zodToJsonSchema(loginResponseBody),
        },
      },
    },
    async function login(req, res) {
      const identity = await getOwnIdentity(app.db, req.identity.userID)
      if (!identity) {
        throw app.httpErrors.notFound(
          `No identity found for user id ${req.identity.userID}`
        )
      }
      return res.send(identity)
    }
  )
}
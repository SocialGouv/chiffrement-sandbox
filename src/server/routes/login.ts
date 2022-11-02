import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  PublicRouteHeaders,
  publicRouteHeaders
} from '../../modules/api/headers.js'
import {
  loginResponseBody,
  LoginResponseBody
} from '../../modules/api/login.js'
import { isFarFromCurrentTime } from '../../modules/time.js'
import { getOwnIdentity } from '../database/models/identity.js'
import { App } from '../types'

export default async function loginRoutes(app: App) {
  app.get<{
    Headers: PublicRouteHeaders
    Reply: LoginResponseBody
  }>(
    '/login',
    {
      schema: {
        headers: zodToJsonSchema(publicRouteHeaders),
        response: {
          200: zodToJsonSchema(loginResponseBody),
        },
      },
    },
    async function login(req, res) {
      if (isFarFromCurrentTime(req.headers['x-e2esdk-timestamp'])) {
        throw app.httpErrors.forbidden(
          'Request timestamp is too far off current time'
        )
      }
      const identity = await getOwnIdentity(
        app.db,
        req.headers['x-e2esdk-user-id']
      )
      if (!identity) {
        throw app.httpErrors.notFound(
          `No identity found for user id ${req.identity.userId}`
        )
      }
      return res.send(identity)
    }
  )
}

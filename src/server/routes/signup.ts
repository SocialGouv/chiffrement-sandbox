import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  PublicRouteHeaders,
  publicRouteHeaders,
} from '../../modules/api/headers.js'
import {
  signupRequestBody,
  SignupRequestBody,
} from '../../modules/api/signup.js'
import { App } from '../types'

export default async function signupRoutes(app: App) {
  app.post<{
    Headers: PublicRouteHeaders
    Body: SignupRequestBody
  }>(
    '/signup',
    {
      schema: {
        headers: zodToJsonSchema(publicRouteHeaders),
        body: zodToJsonSchema(signupRequestBody),
        response: {
          201: {
            type: 'null',
            description: 'Account has been created',
          },
        },
      },
    },
    async function signup(req, res) {
      // todo: Store in database
      req.log.info({ body: req.body })
      return res.status(201).send()
    }
  )
}

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
      const { userID } = req.identity
      // todo: Fetch from database
      const signature = app.sodium.crypto_sign_keypair('base64')
      const sharing = app.sodium.crypto_box_keypair('base64')
      return res.send({
        signaturePublicKey: signature.publicKey,
        signaturePrivateKey: signature.privateKey,
        sharingPublicKey: sharing.publicKey,
        sharingPrivateKey: sharing.privateKey,
      })
    }
  )
}

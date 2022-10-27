import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { PublicKeyAuthHeaders } from '../../modules/api/headers.js'
import { App } from '../types'

const infoResponseBody = z.object({
  release: z.string(),
  deploymentURL: z.string(),
  signaturePublicKey: z.string(),
})

export default async function infoRoutes(app: App) {
  app.get<{
    Headers: PublicKeyAuthHeaders
    Reply: z.TypeOf<typeof infoResponseBody>
  }>(
    '/info',
    {
      schema: {
        response: {
          200: zodToJsonSchema(infoResponseBody),
        },
      },
    },
    async function info(_, res) {
      // todo: Use type-safe env
      return res.send({
        release: process.env.RELEASE_TAG!,
        deploymentURL: process.env.DEPLOYMENT_URL!,
        signaturePublicKey: process.env.SIGNATURE_PUBLIC_KEY!,
      })
    }
  )
}

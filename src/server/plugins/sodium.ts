import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { initializeSodium, Sodium } from '../../modules/crypto/sodium.js'
import { checkSignaturePublicKey } from '../../modules/crypto/utils.js'
import type { App } from '../types'

declare module 'fastify' {
  interface FastifyInstance {
    sodium: Sodium
  }
}

const sodiumPlugin: FastifyPluginAsync = async (app: App) => {
  const sodium = await initializeSodium()
  // Verify server signature key pair
  const publicKey = sodium.from_base64(process.env.SIGNATURE_PUBLIC_KEY)
  const privateKey = sodium.from_base64(process.env.SIGNATURE_PRIVATE_KEY)
  if (!checkSignaturePublicKey(sodium, publicKey, privateKey)) {
    app.log.fatal({
      msg: 'Mismatching signature public & private keys',
      description:
        'The public key given in the `SIGNATURE_PUBLIC_KEY` environment variable does not match the private key given in the `SIGNATURE_PRIVATE_KEY` environment variable',
      remediation:
        'Generate a valid signature key pair with `yarn keygen signature`',
    })
    process.exit(1)
  }
  app.decorate('sodium', sodium)
}

export default fp(sodiumPlugin, {
  fastify: '4.x',
  name: 'sodium',
})

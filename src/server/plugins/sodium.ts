import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { initializeSodium, Sodium } from '../../modules/crypto/sodium.js'
import type { App } from '../types'

declare module 'fastify' {
  interface FastifyInstance {
    sodium: Sodium
  }
}

const sodiumPlugin: FastifyPluginAsync = async (app: App) => {
  app.decorate('sodium', await initializeSodium())
}

export default fp(sodiumPlugin, {
  fastify: '4.x',
  name: 'sodium',
})

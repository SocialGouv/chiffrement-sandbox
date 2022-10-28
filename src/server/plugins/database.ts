import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import postgres from 'postgres'
import type { App } from '../types'

declare module 'fastify' {
  interface FastifyInstance {
    db: postgres.Sql
  }
}

const databasePlugin: FastifyPluginAsync = async (app: App) => {
  app.decorate(
    'db',
    postgres(process.env.POSTGRESQL_URL!, {
      transform: postgres.camel,
    })
  )
}

export default fp(databasePlugin, {
  fastify: '4.x',
  name: 'database',
})

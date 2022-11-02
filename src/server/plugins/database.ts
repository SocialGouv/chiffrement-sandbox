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
      debug:
        process.env.DEBUG &&
        function debugDatabaseQuery(connection, query, parameters, paramTypes) {
          app.log.debug({
            msg: 'database:debug',
            connection,
            query: query.replace(/\s+/gm, ' ').trim(), // minify
            parameters,
            paramTypes,
          })
        },
    })
  )
}

export default fp(databasePlugin, {
  fastify: '4.x',
  name: 'database',
})

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
      types: {
        // Keep dates as ISO-8601 strings (not as Date objects)
        // https://github.com/porsager/postgres/issues/161
        date: {
          // Those oid numbers can be found in the `pg_catalog.pg_type` table.
          to: 1184, // timestamptz
          from: [
            1082, // date
            1083, // time
            1114, // timestamp
            1184, // timestamptz
          ],
          serialize: x => x,
          parse: x => new Date(x).toISOString(),
        },
      },
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

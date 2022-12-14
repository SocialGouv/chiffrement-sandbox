import { createServer as createFastifyServer } from 'fastify-micro'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { App } from './types'

export { startServer } from 'fastify-micro'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const healthCheckReply = z.object({
  services: z.object({
    database: z.object({
      status: z.enum(['starting', 'ok', 'down']),
      sizeUsed: z.number(),
      sizeMax: z.number(),
      sizeRatio: z.number(),
    }),
  }),
  metrics: z.object({
    eventLoopDelay: z.number(),
    rssBytes: z.number(),
    heapUsed: z.number(),
    eventLoopUtilized: z.number(),
  }),
})

type HealthCheckReply = z.infer<typeof healthCheckReply>

export function createServer() {
  const __PROD__ = process.env.NODE_ENV === 'production'

  const app = createFastifyServer({
    name: ['e2esdk', process.env.RELEASE_TAG].join(':'),

    redactEnv: __PROD__ ? ['POSTGRESQL_URL', 'SIGNATURE_PRIVATE_KEY'] : [],
    // Give Next.js time to setup in development
    pluginTimeout: __PROD__ ? 10_000 : 60_000,
    plugins: {
      dir: path.resolve(__dirname, 'plugins'),
      forceESM: true,
    },
    routes: {
      dir: path.resolve(__dirname, 'routes'),
      forceESM: true,
      options: {
        prefix: '/api',
      },
    },
    printRoutes: __PROD__ ? 'logger' : false,
    // sentry: {
    //   release: process.env.RELEASE_TAG,
    //   environment: getSentryEnvironment(process.env.RELEASE_TAG),
    //   getUser: getUserForSentry,
    //   getExtra: getExtrasForSentry,
    // },
    underPressure: {
      exposeStatusRoute: {
        url: '/_health',
        routeOpts: {
          logLevel: 'error',
        },
        routeResponseSchemaOpts: (zodToJsonSchema(healthCheckReply) as any)
          .properties,
      },
      healthCheck: async function healthCheck(
        app: App
      ): Promise<HealthCheckReply | false> {
        try {
          let result = await app.db<
            { sizeUsed: string }[]
          >`SELECT pg_database_size(current_database()::name) AS size_used`
          const sizeUsed = parseInt(result[0].sizeUsed)
          const sizeMax = parseInt(process.env.DATABASE_MAX_SIZE_BYTES || '0')
          const sizeRatio = sizeMax > 0 ? sizeUsed / sizeMax : 0
          return {
            services: {
              database: {
                status: 'ok',
                sizeMax,
                sizeUsed,
                sizeRatio,
              },
            },
            metrics: app.memoryUsage(),
          }
        } catch (error) {
          app.log.error(error)
          app.sentry.report(error)
          return false
        }
      },
    },
    cleanupOnExit: async app => {
      app.log.info('Closing connections to backing services')
      try {
        await app.db.end({ timeout: 5_000 })
      } catch (error) {
        app.log.error(error)
        app.sentry.report(error)
      } finally {
        app.log.info('Closed all connections to backing services')
      }
    },
  })

  app.ready(() => {
    if (process.env.DEBUG) {
      app.log.info(
        'Plugins loaded:\n' +
          app
            .printPlugins()
            .split('\n')
            .filter(
              line =>
                !line.includes(' bound _after ') && !line.includes(' _default ')
            )
            .map(line =>
              line.replace(
                path.resolve(__dirname, '../../node_modules') + '/',
                ''
              )
            )
            .join('\n')
      )
      app.log.info(
        'Routes loaded:\n' +
          app.printRoutes({ commonPrefix: false, includeHooks: true })
      )
    }
    app.log.info(
      {
        release: process.env.RELEASE_TAG,
        deploymentURL: process.env.DEPLOYMENT_URL,
        signaturePublicKey: process.env.SIGNATURE_PUBLIC_KEY,
      },
      'Server info'
    )
  })

  return app
}

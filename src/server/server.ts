import { checkEnv } from '@47ng/check-env'
import { createServer as createFastifyServer } from 'fastify-micro'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export { startServer } from 'fastify-micro'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createServer() {
  const __PROD__ = process.env.NODE_ENV === 'production'
  checkEnv({
    required: [
      'DEPLOYMENT_URL',
      'SIGNATURE_PUBLIC_KEY',
      'SIGNATURE_PRIVATE_KEY',
      'NEXT_PUBLIC_RELEASE_TAG',
      'POSTGRESQL_URL',
      'RELEASE_TAG',
    ],
  })

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
      },
      // healthCheck: async function healthCheck(
      //   app: App
      // ): Promise<HealthCheckReply | false> {
      //   try {
      //     const database: HealthCheckReply['services']['database'] = {
      //       status: Boolean(app.prisma) ? 'down' : 'starting',
      //       sizeMax: parseInt(process.env.DATABASE_MAX_SIZE_BYTES || '0'),
      //       sizeUsed: 0,
      //       sizeRatio: 0,
      //     }
      //     if (app.prisma) {
      //       const result = await app.prisma.$queryRawUnsafe<
      //         { pg_size: number }[]
      //       >(`select pg_database_size('${databaseName}'::name) as pg_size;`)
      //       const { pg_size } = result[0]
      //       database.sizeUsed = pg_size
      //       database.sizeRatio =
      //         database.sizeMax > 0 ? database.sizeUsed / database.sizeMax : 0
      //       database.status = 'ok'
      //     }
      //     const redis: HealthCheckReply['services']['redis'] = {
      //       status: Boolean(app.redis?.client) ? 'down' : 'starting',
      //       memoryMax: 0,
      //       memoryUsed: 0,
      //       memoryRatio: 0,
      //     }
      //     if (app.redis?.client) {
      //       const redisInfo = (await app.redis.client.info('memory'))
      //         .split('\r\n')
      //         .map(line => line.trim())
      //         .reduce(
      //           (obj, line) => {
      //             const [key, value] = line.split(':')
      //             return {
      //               ...obj,
      //               [key]: Number.isSafeInteger(+value)
      //                 ? parseInt(value)
      //                 : value,
      //             }
      //           },
      //           {
      //             used_memory: 0,
      //             maxmemory: 0,
      //           }
      //         )
      //       redis.memoryUsed = redisInfo.used_memory
      //       redis.memoryMax = redisInfo.maxmemory
      //       redis.memoryRatio =
      //         redis.memoryMax > 0 ? redis.memoryUsed / redis.memoryMax : 0
      //       redis.status = 'ok'
      //     }
      //     return {
      //       services: {
      //         database,
      //         redis,
      //       },
      //       metrics: app.memoryUsage(),
      //     }
      //   } catch (error) {
      //     app.log.error(error)
      //     app.sentry.report(error)
      //     return false
      //   }
      // },
    },
    cleanupOnExit: async app => {
      app.log.info('Closing connections to backing services')
      try {
        await Promise.all([
          // app.db.$disconnect(),
        ])
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

import fastifyNextJS from '@fastify/nextjs'
import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify'
import fp from 'fastify-plugin'
import type { App } from '../types'

declare module 'http' {
  interface IncomingMessage {
    fastify: FastifyInstance
    log: FastifyBaseLogger
    fastifyReq: FastifyRequest
    fastifyRes: FastifyReply
  }
}

const nextJsPlugin: FastifyPluginAsync<any> = async app => {
  await app
    .register(fastifyNextJS, {
      noServeAssets: true,
    })
    .after()

  app.next('/', { logLevel: 'warn' })
  app.next('/_next/*', { logLevel: 'warn' })

  /**
   * Inject the fastify instance for the following routes,
   * so it can be accessed in getServerSideProps.
   */
  const backendRoutes: string[] = []

  function injectFastifyServer(
    this: App,
    req: FastifyRequest,
    res: FastifyReply,
    done: HookHandlerDoneFunction
  ) {
    req.raw.fastify = app
    req.raw.log = app.log
    req.raw.fastifyReq = req
    req.raw.fastifyRes = res
    done()
  }

  backendRoutes.forEach(route =>
    app.next(route, {
      onRequest: injectFastifyServer,
    })
  )

  // Register the remaining Next.js routes
  app.next('/*', { logLevel: 'info' })

  app.log.info('Next.js is ready')
}

export default fp(nextJsPlugin, {
  fastify: '4.x',
  name: 'nextjs',
})

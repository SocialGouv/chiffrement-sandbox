import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { createServer, startServer } from './server.js'

export async function main() {
  // Setup environment
  dotenv.config()
  const appServer = createServer()
  await startServer(appServer)
  appServer.log.info(
    `Server signature public key: ${process.env.SIGNATURE_PUBLIC_KEY}`
  )
}

// --

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}

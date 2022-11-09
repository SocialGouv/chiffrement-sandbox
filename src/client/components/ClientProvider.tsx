import { useToast } from '@chakra-ui/react'
import React from 'react'
import {
  APIError,
  Client,
  PublicUserIdentity,
} from '../../modules/crypto/client.js'
import { sodium } from '../../modules/crypto/sodium.js'

const client = new Client(sodium, {
  serverPublicKey: process.env.NEXT_PUBLIC_SERVER_SIGNATURE_PUBLIC_KEY!,
  serverURL: process.env.NEXT_PUBLIC_DEPLOYMENT_URL! + '/api',
})

const ClientContext = React.createContext(client)

type ClientProviderProps = {
  children: React.ReactNode
}

export const ClientProvider: React.FC<ClientProviderProps> = props => (
  <ClientContext.Provider value={client} {...props} />
)

export function useClient() {
  return React.useContext(ClientContext)
}

// --

export function useClientIdentity() {
  const client = useClient()
  const [identity, setIdentity] = React.useState<PublicUserIdentity | null>(
    () => {
      try {
        return client.publicIdentity
      } catch {
        return null
      }
    }
  )
  React.useEffect(() => {
    return client.on('identityUpdated', identity => setIdentity(identity))
  }, [client])
  return identity
}

export function useClientKeys(indexBy: 'name' | 'nameFingerprint' = 'name') {
  const client = useClient()
  const [keys, setKeys] = React.useState(() => client.getKeysBy(indexBy))
  React.useEffect(() => {
    return client.on('keychainUpdated', () =>
      setKeys(client.getKeysBy(indexBy))
    )
  }, [client, indexBy])
  return keys
}

export function useShareKey() {
  const client = useClient()
  const toast = useToast({
    position: 'bottom-right',
  })

  return React.useCallback(
    async (keyName: string | null, to: PublicUserIdentity | null) => {
      if (!keyName || !to) {
        return
      }
      try {
        await client.shareKey(keyName, to)
        toast({
          status: 'success',
          title: 'Key shared',
          description: `Key ${keyName} was sent to ${to.userId}`,
        })
      } catch (error) {
        if (error instanceof APIError) {
          if (error.statusCode === 409) {
            toast({
              status: 'info',
              title: 'Not needed',
              description: error.message,
            })
          } else {
            toast({
              status: 'error',
              title: error.statusText,
              description: error.message,
            })
          }
        } else {
          toast({
            status: 'error',
            title: (error as any).name,
            description: (error as any).message ?? String(error),
          })
        }
      }
    },
    [client, toast]
  )
}

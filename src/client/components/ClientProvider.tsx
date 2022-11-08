import React from 'react'
import { Client, PublicUserIdentity } from '../../modules/crypto/client.js'
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

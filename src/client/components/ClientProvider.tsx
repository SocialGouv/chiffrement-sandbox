import React from 'react'
import { Client } from '../../modules/crypto/client.js'
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

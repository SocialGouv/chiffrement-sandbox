import { Stack, StackProps, Text } from '@chakra-ui/react'
import { PublicUserIdentity } from 'modules/crypto/client'
import { base64UrlEncode } from 'modules/crypto/codec'
import React from 'react'

type IdentityProps = StackProps & {
  identity: PublicUserIdentity
}

export const Identity: React.FC<IdentityProps> = ({ identity, ...props }) => {
  return (
    <Stack {...props}>
      <Text>User ID: {identity.userId}</Text>
      <Text>Sharing: {base64UrlEncode(identity.sharingPublicKey)}</Text>
      <Text>Signature: {base64UrlEncode(identity.signaturePublicKey)}</Text>
    </Stack>
  )
}

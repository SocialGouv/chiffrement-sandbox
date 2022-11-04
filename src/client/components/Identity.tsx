import { Icon, Stack, StackProps, Text } from '@chakra-ui/react'
import { PublicUserIdentity } from 'modules/crypto/client'
import { base64UrlEncode } from 'modules/crypto/codec'
import React from 'react'
import { FiLock, FiPenTool, FiUser } from 'react-icons/fi'

type IdentityProps = StackProps & {
  identity: PublicUserIdentity
}

export const Identity: React.FC<IdentityProps> = ({ identity, ...props }) => {
  return (
    <Stack
      fontFamily="mono"
      fontSize="sm"
      borderWidth="1px"
      px={4}
      py={3}
      rounded="md"
      boxShadow="lg"
      {...props}
    >
      <Text>
        <Icon as={FiUser} mr={2} transform="translateY(2px)" />{' '}
        {identity.userId}
      </Text>
      <Text>
        <Icon as={FiLock} mr={2} transform="translateY(2px)" />{' '}
        {base64UrlEncode(identity.sharingPublicKey)}
      </Text>
      <Text>
        <Icon as={FiPenTool} mr={2} transform="translateY(2px)" />{' '}
        {base64UrlEncode(identity.signaturePublicKey)}
      </Text>
    </Stack>
  )
}

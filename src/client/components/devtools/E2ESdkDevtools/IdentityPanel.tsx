import { Button, Stack, StackProps } from '@chakra-ui/react'
import { useClient, useClientIdentity } from 'client/components/ClientProvider'
import { Identity } from 'client/components/Identity'
import React from 'react'
import { FiLogOut } from 'react-icons/fi'

export const IdentityPanel: React.FC<StackProps> = ({ ...props }) => {
  const client = useClient()
  const identity = useClientIdentity()
  if (!identity) {
    return null
  }
  return (
    <Stack spacing={4} {...props}>
      <Identity identity={identity} />
      <Button
        colorScheme="red"
        variant="outline"
        size="sm"
        w={32}
        leftIcon={<FiLogOut />}
        onClick={() => client.logout()}
      >
        Log out
      </Button>
    </Stack>
  )
}

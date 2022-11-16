import { BoxProps, Button, Icon, Stack } from '@chakra-ui/react'
import { useClient, useClientIdentity } from 'client/components/ClientProvider'
import { Identity } from 'client/components/Identity'
import { UserIdentity } from 'client/components/UserIdentity'
import { PublicUserIdentity } from 'modules/crypto/client'
import React from 'react'
import { FiLogOut, FiSearch, FiUser } from 'react-icons/fi'
import { Section, SectionContainer, SectionHeader } from './components/Sections'

export const IdentityPanel: React.FC = () => {
  return (
    <SectionContainer position="absolute" inset={0}>
      <YourIdentitySection />
      <FindUsersSection />
    </SectionContainer>
  )
}

// --

const YourIdentitySection = (props: BoxProps) => {
  const client = useClient()
  const identity = useClientIdentity()
  if (!identity) {
    return null
  }
  return (
    <Section {...props}>
      <SectionHeader mt={0}>
        <Icon as={FiUser} ml="2px" mr={2} transform="translateY(2px)" />
        Your identity
      </SectionHeader>
      <Stack spacing={4} px={4}>
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
    </Section>
  )
}

// --

const FindUsersSection = (props: BoxProps) => {
  const [identity, setIdentity] = React.useState<PublicUserIdentity | null>(
    null
  )
  return (
    <Section {...props}>
      <SectionHeader mt={0}>
        <Icon as={FiSearch} mr={2} transform="translateY(2px)" />
        Find users
      </SectionHeader>
      <Stack spacing={4} px={4}>
        <UserIdentity
          identity={identity}
          onIdentityChange={setIdentity}
          showPublicKey={false}
        />
        {identity && <Identity identity={identity} />}
      </Stack>
    </Section>
  )
}

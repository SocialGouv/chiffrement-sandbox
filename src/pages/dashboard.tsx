import { Heading, Link, Stack, Text } from '@chakra-ui/react'
import {
  useClientIdentity,
  useClientKeys,
} from 'client/components/ClientProvider'
import { Identity } from 'client/components/Identity'
import { NoSSR } from 'client/components/NoSSR'
import type { NextPage } from 'next'
import NextLink from 'next/link'

const DashboardPage: NextPage = () => {
  const identity = useClientIdentity()
  const keys = useClientKeys()
  return (
    <>
      <Heading as="h1">Dashboard</Heading>
      <Stack spacing={4} mt={8}>
        <NoSSR>{identity && <Identity identity={identity} />}</NoSSR>
        <NextLink href="/new-key">
          <Link>New key</Link>
        </NextLink>
        <NoSSR>
          {keys.map(key => (
            <Text key={key.name + key.createdAt.toISOString()}>
              {key.name}: {key.cipher.algorithm} - {key.createdAt.toISOString()}
            </Text>
          ))}
        </NoSSR>
      </Stack>
    </>
  )
}

export default DashboardPage

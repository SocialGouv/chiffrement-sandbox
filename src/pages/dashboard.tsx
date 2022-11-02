import { Heading, Link, Stack } from '@chakra-ui/react'
import { useClientIdentity } from 'client/components/ClientProvider'
import { Identity } from 'client/components/Identity'
import type { NextPage } from 'next'
import NextLink from 'next/link'

const DashboardPage: NextPage = () => {
  const identity = useClientIdentity()
  return (
    <>
      <Heading as="h1">Dashboard</Heading>
      <Stack spacing={4} mt={8}>
        {identity && <Identity identity={identity} />}
        <NextLink href="/new-key">
          <Link>New key</Link>
        </NextLink>
      </Stack>
    </>
  )
}

export default DashboardPage

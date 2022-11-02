import { Heading, Stack } from '@chakra-ui/react'
import { useClientIdentity } from 'client/components/ClientProvider'
import { Identity } from 'client/components/Identity'
import type { NextPage } from 'next'

const DashboardPage: NextPage = () => {
  const identity = useClientIdentity()
  return (
    <>
      <Heading as="h1">Dashboard</Heading>
      <Stack spacing={4} mt={8}>
        {identity && <Identity identity={identity} />}
      </Stack>
    </>
  )
}

export default DashboardPage

import { Heading, Input, Stack, Text } from '@chakra-ui/react'
import { useLocalStateSync } from 'client/hooks/useLocalStateSync'
import type { NextPage } from 'next'

const LocalStateSyncTestPage: NextPage = () => {
  const [state, setState] = useLocalStateSync('', {
    encryptionKey: '2HX1EIwXaY4FwuRtTGiVTspVGQL5mxezuvW4c1J1AcM',
  })
  return (
    <>
      <Heading as="h1">Local State Sync</Heading>
      <Stack spacing={4} mt={8}>
        <Text>
          <a href="/tests/local-state-sync" target="_blank">
            Open this page
          </a>{' '}
          in multiple tabs and edit the input:
        </Text>
        <Input value={state} onChange={e => setState(e.target.value)} />
      </Stack>
    </>
  )
}

export default LocalStateSyncTestPage

import {
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Select,
  Stack,
} from '@chakra-ui/react'
import { useClientKeys, useShareKey } from 'client/components/ClientProvider'
import { LoadingButton } from 'client/components/LoadingButton'
import { NoSSR } from 'client/components/NoSSR'
import { UserIdentity } from 'client/components/UserIdentity'
import { PublicUserIdentity } from 'modules/crypto/client'
import type { NextPage } from 'next'
import React from 'react'
import { FiShare2 } from 'react-icons/fi'

const ShareKeyPage: NextPage = () => {
  const [keyName, setKeyName] = React.useState('')
  const keys = useClientKeys()
  const key = keys[keyName]?.[0]
  const [toUser, setToUserIdentity] = React.useState<PublicUserIdentity | null>(
    null
  )
  const shareKey = useShareKey()

  return (
    <>
      <Heading as="h1">Share key</Heading>
      <Stack spacing={4} mt={8}>
        <FormControl>
          <FormLabel>Key name</FormLabel>
          <Select
            value={keyName}
            onChange={e => setKeyName(e.target.value)}
            placeholder="Select a key"
          >
            <NoSSR>
              {Object.keys(keys).map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NoSSR>
          </Select>
          {key && (
            <FormHelperText>
              Type: {key.algorithm} - Created{' '}
              {key.createdAt.toLocaleString(['se-SE'])}
            </FormHelperText>
          )}
        </FormControl>
        <UserIdentity
          label="Share with"
          identity={toUser}
          onIdentityChange={setToUserIdentity}
        />
        <LoadingButton
          onClick={() => shareKey(keyName, toUser)}
          leftIcon={<FiShare2 />}
        >
          Share
        </LoadingButton>
      </Stack>
    </>
  )
}

export default ShareKeyPage

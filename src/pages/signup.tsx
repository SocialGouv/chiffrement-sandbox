import {
  Button,
  FormControl,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Stack,
} from '@chakra-ui/react'
import type { NextPage } from 'next'
import React from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { useClient } from '../client/components/ClientProvider'
import { generateSecretBoxCipher } from '../modules/crypto/ciphers'

const SignupPage: NextPage = () => {
  const [userId, setUserId] = React.useState('')
  const [personalKey, setPersonalKey] = React.useState('')
  const client = useClient()
  const signUp = React.useCallback(async () => {
    await client.signup(userId, client.decode(personalKey))
    console.dir(client.publicIdentity)
  }, [userId, personalKey, client])

  return (
    <>
      <Heading as="h1">Sign up</Heading>
      <Stack spacing={4} mt={8}>
        <FormControl>
          <FormLabel>User ID</FormLabel>
          <InputGroup>
            <Input
              fontFamily="mono"
              value={userId}
              onChange={e => setUserId(e.target.value)}
            />
            <InputRightElement>
              <IconButton
                aria-label="Randomize"
                icon={<FiRefreshCw />}
                onClick={() => setUserId(window.crypto.randomUUID())}
                rounded="full"
                variant="ghost"
              />
            </InputRightElement>
          </InputGroup>
        </FormControl>
        <FormControl>
          <FormLabel>Personal Key</FormLabel>
          <InputGroup>
            <Input
              fontFamily="mono"
              value={personalKey}
              onChange={e => setPersonalKey(e.target.value)}
            />
            <InputRightElement>
              <IconButton
                aria-label="Randomize"
                icon={<FiRefreshCw />}
                onClick={() =>
                  setPersonalKey(
                    client.encode(generateSecretBoxCipher(client.sodium).key)
                  )
                }
                rounded="full"
                variant="ghost"
              />
            </InputRightElement>
          </InputGroup>
        </FormControl>
        <Button type="submit" onClick={signUp}>
          Sign up
        </Button>
      </Stack>
    </>
  )
}

export default SignupPage

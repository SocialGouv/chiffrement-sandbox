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
import { useRouter } from 'next/router'
import React from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { useClient } from '../client/components/ClientProvider'
import { generateSecretBoxCipher } from '../modules/crypto/ciphers'

const LoginPage: NextPage = () => {
  const [userId, setUserId] = React.useState('')
  const [personalKey, setPersonalKey] = React.useState('')
  const router = useRouter()
  const client = useClient()
  const login = React.useCallback(async () => {
    await client.login(userId, client.decode(personalKey))
    await router.push('/dashboard')
  }, [userId, personalKey, client, router])

  return (
    <>
      <Heading as="h1">Log in</Heading>
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
        <Button type="submit" onClick={login}>
          Log in
        </Button>
      </Stack>
    </>
  )
}

export default LoginPage

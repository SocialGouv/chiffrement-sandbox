import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Select,
  Stack,
  useToast,
} from '@chakra-ui/react'
import { useClient } from 'client/components/ClientProvider'
import {
  generateSealedBoxCipher,
  generateSecretBoxCipher,
} from 'modules/crypto/ciphers'
import type { NextPage } from 'next'
import React from 'react'

enum KeyTypes {
  secretBox = 'secretBox',
  sealedBox = 'sealedBox',
}

const NewKeyPage: NextPage = () => {
  const client = useClient()
  const [name, setName] = React.useState('')
  const [type, setType] = React.useState<KeyTypes>(KeyTypes.secretBox)
  const toast = useToast({ position: 'bottom-right' })
  const createKey = React.useCallback(async () => {
    const cipher =
      type === KeyTypes.secretBox
        ? generateSecretBoxCipher(client.sodium)
        : generateSealedBoxCipher(client.sodium)

    await client.addKey({
      name,
      cipher,
    })
    setName('')
    toast({
      title: 'Key created',
      description: 'It has been saved in your keychain',
    })
  }, [client, name, type, toast])

  return (
    <>
      <Heading as="h1">Create new key</Heading>
      <Stack spacing={4} mt={8}>
        <FormControl>
          <FormLabel>Name</FormLabel>
          <Input value={name} onChange={e => setName(e.target.value)} />
          <FormHelperText>What will the key be used for?</FormHelperText>
        </FormControl>
        <FormControl>
          <FormLabel>Type</FormLabel>
          <Select
            value={type}
            onChange={e => setType(e.target.value as KeyTypes)}
          >
            <option value={KeyTypes.secretBox}>Secret Box</option>
            <option value={KeyTypes.sealedBox}>Sealed Box</option>
          </Select>
          <FormHelperText>
            {type === KeyTypes.secretBox && (
              <>Encrypt & decrypt using a secret key, for shared workspaces</>
            )}
            {type === KeyTypes.sealedBox && (
              <>Collect anonymous data from outsiders using a public key</>
            )}
          </FormHelperText>
        </FormControl>
        <Button onClick={createKey}>
          Create key{type === KeyTypes.sealedBox && ' pair'}
        </Button>
      </Stack>
    </>
  )
}

export default NewKeyPage

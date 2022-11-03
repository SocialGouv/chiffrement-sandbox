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
import { useClient, useClientKeys } from 'client/components/ClientProvider'
import { NoSSR } from 'client/components/NoSSR'
import { APIError, PublicUserIdentity } from 'modules/crypto/client'
import type { NextPage } from 'next'
import React from 'react'
import { FiShare2 } from 'react-icons/fi'

const ShareKeyPage: NextPage = () => {
  const [keyName, setKeyName] = React.useState('')
  const [toUserId, setToUserId] = React.useState('')
  const [toUser, setToUser] = React.useState<PublicUserIdentity | null>(null)
  const keys = useClientKeys()
  const client = useClient()
  const key = keys.find(k => k.name === keyName)
  const toast = useToast({
    position: 'bottom-right',
  })

  const getRecipientIdentity = React.useCallback(async () => {
    if (!toUserId.trim()) {
      return
    }
    const identity = await client.getUserIdentity(toUserId)
    if (!identity) {
      toast({
        status: 'warning',
        title: 'Not found',
        description: `Could not find an identity for user ID ${toUserId}`,
      })
    }
    setToUser(identity)
  }, [toUserId, client, toast])

  const shareKey = React.useCallback(async () => {
    if (!key || !toUser) {
      return
    }
    try {
      await client.shareKey(key, toUser)
      toast({
        status: 'success',
        title: 'Key shared',
        description: `Key ${key.name} was sent to ${toUser.userId}`,
      })
    } catch (error) {
      if (error instanceof APIError) {
        if (error.statusCode === 409) {
          toast({
            status: 'info',
            title: 'Not needed',
            description: error.message,
          })
        } else {
          toast({
            status: 'error',
            title: error.statusText,
            description: error.message,
          })
        }
      } else {
        toast({
          status: 'error',
          title: (error as any).name,
          description: (error as any).message ?? String(error),
        })
      }
    }
  }, [client, key, toUser, toast])

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
              {keys.map(({ name }) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NoSSR>
          </Select>
          {key && (
            <FormHelperText>
              Type: {key.cipher.algorithm} - Created{' '}
              {key.createdAt.toLocaleString()}
            </FormHelperText>
          )}
        </FormControl>
        <FormControl>
          <FormLabel>Share with</FormLabel>
          <Input
            value={toUserId}
            onChange={e => setToUserId(e.target.value)}
            onBlur={getRecipientIdentity}
          />
          {toUser && (
            <FormHelperText>
              Public key: {client.encode(toUser.signaturePublicKey)}
            </FormHelperText>
          )}
        </FormControl>
        <Button onClick={shareKey} leftIcon={<FiShare2 />}>
          Share
        </Button>
      </Stack>
    </>
  )
}

export default ShareKeyPage

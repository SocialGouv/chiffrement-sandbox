import {
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Icon,
  Input,
  SkeletonText,
  Stack,
  StackProps,
  Text,
  useToast,
} from '@chakra-ui/react'
import { AlgorithmBadge } from 'client/components/AlgorithmBadge'
import { useClient, useClientKeys } from 'client/components/ClientProvider'
import { LoadingButton } from 'client/components/LoadingButton'
import { NoSSR } from 'client/components/NoSSR'
import { APIError, PublicUserIdentity } from 'modules/crypto/client'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import React from 'react'
import { FiCheckSquare, FiLock, FiUserX } from 'react-icons/fi'

const KeyPage: NextPage = () => {
  const keys = useClientKeys()
  const keyName = useRouter().query.name as string
  const revisions = keys[keyName] ?? []
  return (
    <NoSSR fallback={<SkeletonText />}>
      <>
        <Heading as="h1" fontSize="2xl" fontFamily="mono" mt={8}>
          {keyName}
        </Heading>
        <Flex justifyContent="space-between" alignItems="baseline">
          <Heading as="h2" fontSize="xl" mt={8}>
            Revisions
          </Heading>
          {revisions[0] && (
            <AlgorithmBadge algorithm={revisions[0].algorithm} />
          )}
        </Flex>
        <Stack mt={4}>
          {revisions.map((key, index) => (
            <Flex
              key={key.createdAt.toISOString()}
              pl={2}
              position="relative"
              opacity={index === 0 ? 1 : 0.3}
              _before={{
                position: 'absolute',
                content: '""',
                w: '2px',
                left: 0,
                top: 0,
                bottom: 0,
                borderRadius: '2px',
                background: index === 0 ? 'green.500' : 'gray.500',
              }}
            >
              <Text
                fontSize="sm"
                sx={{
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {key.createdAt.toLocaleString(['se-SE'])}
              </Text>
              {key.publicKey && (
                <Text fontFamily="mono" fontSize="sm" ml="auto">
                  <Icon as={FiLock} transform="translateY(2px)" />{' '}
                  {key.publicKey}
                </Text>
              )}
            </Flex>
          ))}
        </Stack>
        <Heading as="h2" fontSize="xl" mt={8}>
          Permissions
        </Heading>
        <Permissions mt={4} />
        <Heading as="h2" fontSize="xl" mt={8}>
          Ban
        </Heading>
        <BanUser mt={4} />
      </>
    </NoSSR>
  )
}

export default KeyPage

// --

const Permissions: React.FC<StackProps> = props => {
  const client = useClient()
  const keyName = useRouter().query.name as string
  const [userId, setUserId] = React.useState('')
  const [toUser, setToUser] = React.useState<PublicUserIdentity | null>(null)
  const [allowSharing, setAllowSharing] = React.useState(false)
  const [allowRotation, setAllowRotation] = React.useState(false)
  const [allowDeletion, setAllowDeletion] = React.useState(false)
  const [allowManagement, setAllowManagement] = React.useState(false)
  const toast = useToast({
    position: 'bottom-right',
  })

  const getRecipientIdentity = React.useCallback(async () => {
    if (!userId.trim()) {
      return
    }
    const identity = await client.getUserIdentity(userId)
    if (!identity) {
      toast({
        status: 'warning',
        title: 'Not found',
        description: `Could not find an identity for user ID ${userId}`,
      })
    }
    setToUser(identity)
  }, [userId, client, toast])

  const onSubmit = React.useCallback(async () => {
    try {
      await client.setPermissions(userId, keyName, {
        allowSharing,
        allowRotation,
        allowDeletion,
        allowManagement,
      })
      toast({
        status: 'success',
        title: 'Permissions applied',
      })
    } catch (error) {
      if (error instanceof APIError) {
        toast({
          status: 'error',
          title: error.statusText,
          description: error.message,
        })
      } else {
        toast({
          status: 'error',
          title: (error as any).name,
          description: (error as any).message ?? String(error),
        })
      }
    }
  }, [
    client,
    userId,
    keyName,
    allowSharing,
    allowRotation,
    allowDeletion,
    allowManagement,
    toast,
  ])

  return (
    <Stack spacing={4} {...props}>
      <FormControl>
        <FormLabel>User ID</FormLabel>
        <Input
          value={userId}
          onChange={e => setUserId(e.target.value)}
          onBlur={getRecipientIdentity}
        />
        {toUser && (
          <FormHelperText>
            Public key: {client.encode(toUser.signaturePublicKey)}
          </FormHelperText>
        )}
      </FormControl>
      <Checkbox
        isChecked={allowSharing}
        onChange={e => setAllowSharing(e.target.checked)}
      >
        Allow sharing
      </Checkbox>
      <Checkbox
        isChecked={allowRotation}
        onChange={e => setAllowRotation(e.target.checked)}
      >
        Allow rotation
      </Checkbox>
      <Checkbox
        isChecked={allowDeletion}
        onChange={e => setAllowDeletion(e.target.checked)}
      >
        Allow deletion
      </Checkbox>
      <Checkbox
        isChecked={allowManagement}
        onChange={e => setAllowManagement(e.target.checked)}
      >
        Allow management
      </Checkbox>
      <LoadingButton leftIcon={<FiCheckSquare />} onClick={onSubmit}>
        Set permissions
      </LoadingButton>
    </Stack>
  )
}

const BanUser: React.FC<StackProps> = props => {
  const client = useClient()
  const keyName = useRouter().query.name as string
  const [userId, setUserId] = React.useState('')
  const [toUser, setToUser] = React.useState<PublicUserIdentity | null>(null)
  const toast = useToast({
    position: 'bottom-right',
  })

  const getRecipientIdentity = React.useCallback(async () => {
    if (!userId.trim()) {
      return
    }
    const identity = await client.getUserIdentity(userId)
    if (!identity) {
      toast({
        status: 'warning',
        title: 'Not found',
        description: `Could not find an identity for user ID ${userId}`,
      })
    }
    setToUser(identity)
  }, [userId, client, toast])

  const onSubmit = React.useCallback(async () => {
    try {
      await client.banUser(userId, keyName)
      toast({
        status: 'success',
        title: 'Ban successful',
        description: `Access to ${keyName} has been revoked for ${userId}`,
      })
    } catch (error) {
      if (error instanceof APIError) {
        toast({
          status: 'error',
          title: error.statusText,
          description: error.message,
        })
      } else {
        toast({
          status: 'error',
          title: (error as any).name,
          description: (error as any).message ?? String(error),
        })
      }
    }
  }, [client, userId, keyName, toast])

  return (
    <Stack spacing={4} {...props}>
      <FormControl>
        <FormLabel>User ID</FormLabel>
        <Input
          value={userId}
          onChange={e => setUserId(e.target.value)}
          onBlur={getRecipientIdentity}
        />
        {toUser && (
          <FormHelperText>
            Public key: {client.encode(toUser.signaturePublicKey)}
          </FormHelperText>
        )}
      </FormControl>
      <LoadingButton leftIcon={<FiUserX />} onClick={onSubmit}>
        Ban user
      </LoadingButton>
    </Stack>
  )
}

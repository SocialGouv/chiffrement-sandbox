import {
  Button,
  Collapse,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Link,
  Stack,
  StackProps,
} from '@chakra-ui/react'
import { useClient, useShareKey } from 'client/components/ClientProvider'
import { CopiableReadOnlyInput } from 'client/components/CopiableReadOnlyInput'
import { LoadingButton } from 'client/components/LoadingButton'
import { UserIdentity } from 'client/components/UserIdentity'
import { generateSealedBoxCipher } from 'modules/crypto/ciphers'
import { PublicUserIdentity } from 'modules/crypto/client'
import type { NextPage } from 'next'
import NextLink from 'next/link'

import React from 'react'
import { FiArrowRight, FiShare2 } from 'react-icons/fi'

type ContactFormMetadata = {
  submissionBucketId: string
  publicKey: string
}

const NewContactFormPage: NextPage = () => {
  const client = useClient()
  const [name, setName] = React.useState('')
  const [meta, setMeta] = React.useState<ContactFormMetadata | null>(null)
  const keyName = `contact-form:${name}`
  const publicURL = meta
    ? `${process.env.NEXT_PUBLIC_DEPLOYMENT_URL}/contact-form/${meta.submissionBucketId}#${meta.publicKey}`
    : null
  const resultsURL = meta
    ? `/app/contact-forms/${meta.submissionBucketId}`
    : null

  const onSubmit = React.useCallback(async () => {
    await client.sodium.ready
    const cipher = generateSealedBoxCipher(client.sodium)
    const { nameFingerprint, publicKey } = await client.addKey({
      name: keyName,
      cipher,
    })
    setMeta({
      submissionBucketId: nameFingerprint,
      publicKey: publicKey!,
    })
  }, [client, keyName])

  return (
    <>
      <Heading as="h1">New contact form</Heading>
      <Collapse in={!publicURL}>
        <FormControl my={8}>
          <FormLabel>Name</FormLabel>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </FormControl>
        <LoadingButton onClick={onSubmit}>Create new form</LoadingButton>
      </Collapse>
      <Collapse in={Boolean(publicURL)}>
        <FormControl mt={8}>
          <FormLabel>Contact form public URL</FormLabel>
          <CopiableReadOnlyInput value={publicURL ?? '#'} />
          <FormHelperText>
            People will use this link to contact you
          </FormHelperText>
        </FormControl>

        <ShareAccess keyName={keyName} mt={8} />
        <Divider my={12} />
        <NextLink href={resultsURL ?? '#'} passHref>
          <Button
            as={Link}
            w="100%"
            colorScheme="green"
            leftIcon={<FiArrowRight />}
            _hover={{
              textDecoration: 'none',
            }}
          >
            Go to submissions
          </Button>
        </NextLink>
      </Collapse>
    </>
  )
}

export default NewContactFormPage

// --

type ShareAccessProps = StackProps & {
  keyName: string
}

export const ShareAccess: React.FC<ShareAccessProps> = ({
  keyName,
  ...props
}) => {
  const [to, setTo] = React.useState<PublicUserIdentity | null>(null)
  const shareKey = useShareKey()
  return (
    <Stack {...props}>
      <Heading as="h2" fontSize="2xl">
        Share access
      </Heading>
      <UserIdentity identity={to} onIdentityChange={setTo} />
      <LoadingButton
        onClick={() => shareKey(keyName, to)}
        leftIcon={<FiShare2 />}
      >
        Share access
      </LoadingButton>
    </Stack>
  )
}

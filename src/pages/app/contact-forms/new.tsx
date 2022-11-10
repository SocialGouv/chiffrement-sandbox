import {
  Button,
  chakra,
  Collapse,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Stack,
  StackProps,
  Text,
  useClipboard,
} from '@chakra-ui/react'
import { useClient, useShareKey } from 'client/components/ClientProvider'
import { LoadingButton } from 'client/components/LoadingButton'
import { UserIdentity } from 'client/components/UserIdentity'
import { generateSealedBoxCipher } from 'modules/crypto/ciphers'
import { PublicUserIdentity } from 'modules/crypto/client'
import type { NextPage } from 'next'
import NextLink from 'next/link'

import React from 'react'
import { FiCheck, FiClipboard } from 'react-icons/fi'

type ContactFormMetadata = {
  submissionBucketId: string
  publicKey: string
}

const NewContactFormPage: NextPage = () => {
  const client = useClient()
  const [name, setName] = React.useState('')
  const [meta, setMeta] = React.useState<ContactFormMetadata | null>(null)
  const slug = `contact-form:${name.replace(/\s/g, '-').toLowerCase()}`
  const publicURL = meta
    ? `${process.env.NEXT_PUBLIC_DEPLOYMENT_URL}/contact-form/${meta.submissionBucketId}#${meta.publicKey}`
    : null
  const resultsURL = meta
    ? `/app/contact-forms/${meta.submissionBucketId}`
    : null

  const { onCopy, hasCopied } = useClipboard(publicURL ?? '#')

  const onSubmit = React.useCallback(async () => {
    await client.sodium.ready
    const cipher = generateSealedBoxCipher(client.sodium)
    const { nameFingerprint, publicKey } = await client.addKey({
      name: slug,
      cipher,
    })
    setMeta({
      submissionBucketId: nameFingerprint,
      publicKey: publicKey!,
    })
  }, [client, slug])

  return (
    <>
      <Heading as="h1">New contact form</Heading>
      <Collapse in={!publicURL}>
        <FormControl my={8}>
          <FormLabel>Name</FormLabel>
          <Input value={name} onChange={e => setName(e.target.value)} />
          {name && (
            <FormHelperText>
              Your contact form key ID will be{' '}
              <chakra.b fontWeight="semibold">{slug}</chakra.b>
            </FormHelperText>
          )}
        </FormControl>
        <LoadingButton onClick={onSubmit}>Create new form</LoadingButton>
      </Collapse>
      <Collapse in={Boolean(publicURL)}>
        <Stack spacing={4} mt={8}>
          <Text>Here is the public URL to your contact form:</Text>
          <InputGroup mt={4}>
            <Input value={publicURL ?? '#'} />
            <InputRightElement>
              <IconButton
                onClick={onCopy}
                icon={hasCopied ? <FiCheck /> : <FiClipboard />}
                colorScheme={hasCopied ? 'green' : undefined}
                aria-label="Copy"
                rounded="full"
                variant="ghost"
              />
            </InputRightElement>
          </InputGroup>
        </Stack>
        <Divider mt={12} mb={10} />
        <ShareAccess keyName={slug} />
        <NextLink href={resultsURL ?? '#'} passHref>
          <Button as="a">Submissions</Button>
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

const ShareAccess: React.FC<ShareAccessProps> = ({ keyName, ...props }) => {
  const [to, setTo] = React.useState<PublicUserIdentity | null>(null)
  const shareKey = useShareKey()
  return (
    <Stack {...props}>
      <Heading as="h2" fontSize="2xl">
        Share access
      </Heading>
      <UserIdentity identity={to} onIdentityChange={setTo} label="With" />
      <LoadingButton onClick={() => shareKey(keyName, to)}>
        Share access
      </LoadingButton>
    </Stack>
  )
}

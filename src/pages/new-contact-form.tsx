import {
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

import React from 'react'
import { FiCheck, FiClipboard } from 'react-icons/fi'

const NewContactFormPage: NextPage = () => {
  const client = useClient()
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState<string | null>(null)
  const {
    onCopy,
    hasCopied,
    setValue: setClipboardValue,
  } = useClipboard(url ?? '#')

  const slug = `contact-form:${name.replace(/\s/g, '-').toLowerCase()}`
  const onSubmit = React.useCallback(async () => {
    await client.sodium.ready
    const cipher = generateSealedBoxCipher(client.sodium)
    const { nameFingerprint, publicKey } = await client.addKey({
      name: slug,
      cipher,
    })
    const url = `${process.env.NEXT_PUBLIC_DEPLOYMENT_URL}/form/${nameFingerprint}#${publicKey}`
    setUrl(url)
    setClipboardValue(url)
  }, [client, slug, setClipboardValue])

  return (
    <>
      <Heading as="h1">New contact form</Heading>
      <Collapse in={!url}>
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
      <Collapse in={Boolean(url)}>
        <Stack spacing={4} mt={8}>
          <Text>Here is the public URL to your contact form:</Text>
          <InputGroup mt={4}>
            <Input value={url ?? '#'} />
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

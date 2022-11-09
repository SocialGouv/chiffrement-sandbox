import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useClipboard,
} from '@chakra-ui/react'
import { useClient } from 'client/components/ClientProvider'
import { LoadingButton } from 'client/components/LoadingButton'
import { generateSealedBoxCipher } from 'modules/crypto/ciphers'
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
  const onSubmit = React.useCallback(async () => {
    await client.sodium.ready
    const cipher = generateSealedBoxCipher(client.sodium)
    const { nameFingerprint, publicKey } = await client.addKey({ name, cipher })
    const url = `${process.env.NEXT_PUBLIC_DEPLOYMENT_URL}/form/${nameFingerprint}#${publicKey}`
    setUrl(url)
    setClipboardValue(url)
  }, [client, name, setClipboardValue])
  const reset = React.useCallback(() => {
    setUrl(null)
    setName('')
  }, [])

  return (
    <>
      <Heading as="h1">New contact form</Heading>
      <FormControl mt={8}>
        <FormLabel>Name</FormLabel>
        <Input value={name} onChange={e => setName(e.target.value)} />
        <FormHelperText></FormHelperText>
      </FormControl>
      <LoadingButton onClick={onSubmit}>Create new form</LoadingButton>
      <Modal isOpen={Boolean(url)} onClose={reset}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Contact form created</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Here is the URL to your contact form:</Text>
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
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={reset}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default NewContactFormPage

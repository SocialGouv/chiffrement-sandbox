import {
  Button,
  Center,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Icon,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
} from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useClient, useClientKeys } from 'client/components/ClientProvider'
import { CopiableReadOnlyInput } from 'client/components/CopiableReadOnlyInput'
import { NoSSR } from 'client/components/NoSSR'
import request, { gql } from 'graphql-request'
import { KeychainItemMetadata } from 'modules/crypto/client'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import React from 'react'
import { FiCheck, FiMail, FiPhone } from 'react-icons/fi'
import { z } from 'zod'
import { ShareAccess } from './new'

const formSchema = z.object({
  subject: z.string(),
  message: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  age: z.number().nullable(),
  contactMe: z.boolean(),
  email: z.string().email().nullable(),
  phoneNumber: z.string().nullable(),
})

const formWithMetadata = formSchema.extend({
  id: z.number(),
  createdAt: z.string().transform(value => new Date(value)),
})

type FormValues = z.infer<typeof formWithMetadata>
type QueryResult = {
  contactFormSubmissions: Array<
    { id: number } & {
      [K in keyof Omit<FormValues, 'id'>]: FormValues[K] extends null
        ? string | null
        : string
    }
  >
}

const ContactFormResultsPage: NextPage = () => {
  const router = useRouter()
  const submissionBucketId = router.query.submissionBucketId as string
  const allKeys = useClientKeys('nameFingerprint')
  const currentKey = allKeys[submissionBucketId]?.[0] ?? null
  const submissions = useContactFormSubmissions(currentKey)
  if (!currentKey) {
    return (
      <Center minH="xs">
        <NoSSR fallback={<Spinner />}>No key available for this form</NoSSR>
      </Center>
    )
  }
  return (
    <>
      <Heading as="h1">{currentKey.name.replace(/^contact-form:/, '')}</Heading>
      <Text fontSize="sm" color="gray.500">
        Contact form submissions
      </Text>
      {(submissions.data?.length ?? 0) === 0 ? (
        <Center minH="2xs">No data available yet.</Center>
      ) : (
        <TableContainer>
          <Table size="sm" mt={8}>
            <Thead>
              <Tr>
                <Th>From</Th>
                <Th>Subject</Th>
                <Th>Message</Th>
                <Th isNumeric>Age</Th>
                <Th textAlign="center">Contact</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Received</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(submissions.data ?? []).map(submission => (
                <TableRow key={submission.id} data={submission} />
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      <FormControl mt={12}>
        <FormLabel>Public URL</FormLabel>
        <CopiableReadOnlyInput
          value={`${process.env.NEXT_PUBLIC_DEPLOYMENT_URL}/contact-form/${submissionBucketId}#${currentKey.publicKey}`}
        />
        <FormHelperText>
          Anyone with this URL will be able to contact you
        </FormHelperText>
      </FormControl>
      <ShareAccess keyName={currentKey.name} mt={8} />
    </>
  )
}

export default ContactFormResultsPage

// --

const NotAvailable = () => {
  return (
    <Text
      color="gray.500"
      _before={{
        content: '"--"',
      }}
      aria-label="N.A."
    />
  )
}

// --

type TableRowProps = {
  data: z.infer<typeof formWithMetadata>
}

const TableRow: React.FC<TableRowProps> = ({ data }) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  return (
    <>
      <Tr
        _hover={{
          background: 'gray.50',
          _dark: {
            background: 'gray.900',
          },
        }}
        onClick={onOpen}
        cursor="pointer"
      >
        <Td>
          {data.firstName} {data.lastName}
        </Td>
        <Td
          maxW="2xs"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {data.subject}
        </Td>
        <Td
          maxW="xs"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {data.message}
        </Td>
        <Td isNumeric>{data.age ?? <NotAvailable />}</Td>
        <Td textAlign="center">
          {data.contactMe && (
            <Icon as={FiCheck} aria-label="yes" color="green.500" />
          )}
        </Td>
        <Td>
          {data.email ? (
            <Link href={`mailto:${data.email}`}>{data.email}</Link>
          ) : (
            <NotAvailable />
          )}
        </Td>
        <Td>
          {data.phoneNumber ? (
            <Link href={`tel:${data.phoneNumber}`}>{data.phoneNumber}</Link>
          ) : (
            <NotAvailable />
          )}
        </Td>
        <Td color="gray.500" fontSize="xs">
          {data.createdAt.toLocaleString(['se-SE'])}
        </Td>
      </Tr>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{data.subject}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontWeight="semibold">
              {data.firstName} {data.lastName}{' '}
              {Boolean(data.age) && (
                <Text
                  as="span"
                  fontWeight="normal"
                  fontSize="sm"
                  color="gray.500"
                >
                  ??? {data.age} years old
                </Text>
              )}
            </Text>
            <Text fontSize="sm" color="gray.500">
              {data.createdAt.toLocaleString(['se-SE'])}
            </Text>
            <Divider my={4} />
            <Text whiteSpace="pre-wrap">{data.message}</Text>
          </ModalBody>
          <ModalFooter gap={4}>
            {data.contactMe && data.email && (
              <Button
                as={Link}
                _hover={{
                  textDecoration: 'none',
                }}
                href={`mailto:${data.email}`}
                leftIcon={<FiMail />}
              >
                Send email
              </Button>
            )}
            {data.contactMe && data.phoneNumber && (
              <Button
                as={Link}
                _hover={{
                  textDecoration: 'none',
                }}
                href={`tel:${data.phoneNumber}`}
                leftIcon={<FiPhone />}
              >
                Call
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

// --

function useContactFormSubmissions(currentKey: KeychainItemMetadata | null) {
  const client = useClient()
  return useQuery({
    queryKey: [
      'contact-forms',
      'submissions',
      { submissionBucketId: currentKey?.nameFingerprint },
    ] as const,
    queryFn: async () => {
      if (!currentKey) {
        return []
      }
      const res = await request<QueryResult>(
        'http://localhost:8080/v1/graphql',
        GET_CONTACT_FORM_SUBMISSIONS_QUERY,
        {
          submissionBucketId: currentKey?.nameFingerprint,
        }
      )
      return (
        res.contactFormSubmissions?.map(({ id, createdAt, ...encrypted }) =>
          formWithMetadata.parse({
            id,
            createdAt,
            subject: client.decrypt(encrypted.subject, currentKey.name),
            message: client.decrypt(encrypted.message, currentKey.name),
            firstName: client.decrypt(encrypted.firstName, currentKey.name),
            lastName: client.decrypt(encrypted.lastName, currentKey.name),
            contactMe: client.decrypt(encrypted.contactMe, currentKey.name),
            age: encrypted.age
              ? client.decrypt(encrypted.age, currentKey.name)
              : null,
            email: encrypted.email
              ? client.decrypt(encrypted.email, currentKey.name)
              : null,
            phoneNumber: encrypted.phoneNumber
              ? client.decrypt(encrypted.phoneNumber, currentKey.name)
              : null,
          })
        ) ?? []
      )
    },
  })
}

const GET_CONTACT_FORM_SUBMISSIONS_QUERY = gql`
  query GetContactFormSubmissions($submissionBucketId: String!) {
    contactFormSubmissions(
      where: { submissionBucketId: { _eq: $submissionBucketId } }
    ) {
      id
      createdAt
      subject
      message
      firstName
      lastName
      age
      contactMe
      email
      phoneNumber
    }
  }
`

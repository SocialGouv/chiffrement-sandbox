import {
  Center,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Icon,
  Input,
  Link,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { useQuery } from '@tanstack/react-query'
import { useClient, useClientKeys } from 'client/components/ClientProvider'
import request, { gql } from 'graphql-request'
import { KeychainItemMetadata } from 'modules/crypto/client'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { FiCheck } from 'react-icons/fi'
import { z } from 'zod'

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
  return (
    <>
      <Heading as="h1">Contact submissions</Heading>
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
                <Tr key={submission.id}>
                  <Td>
                    {submission.firstName} {submission.lastName}
                  </Td>
                  <Td
                    maxW="2xs"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {submission.subject}
                  </Td>
                  <Td
                    maxW="xs"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {submission.message}
                  </Td>
                  <Td isNumeric>{submission.age ?? <NotAvailable />}</Td>
                  <Td textAlign="center">
                    {submission.contactMe && (
                      <Icon as={FiCheck} aria-label="yes" color="green.500" />
                    )}
                  </Td>
                  <Td>
                    {submission.email ? (
                      <Link href={`mailto:${submission.email}`}>
                        {submission.email}
                      </Link>
                    ) : (
                      <NotAvailable />
                    )}
                  </Td>
                  <Td>
                    {submission.phoneNumber ? (
                      <Link href={`tel:${submission.phoneNumber}`}>
                        {submission.phoneNumber}
                      </Link>
                    ) : (
                      <NotAvailable />
                    )}
                  </Td>

                  <Td color="gray.500">
                    {submission.createdAt.toLocaleString(['se-SE'])}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      <FormControl mt={12}>
        <FormLabel>Public URL</FormLabel>
        <Input
          value={`${process.env.NEXT_PUBLIC_DEPLOYMENT_URL}/contact-form/${submissionBucketId}#${currentKey?.publicKey}`}
        />
        <FormHelperText>
          Anyone with this URL will be able to contact you
        </FormHelperText>
      </FormControl>
    </>
  )
}

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

export default ContactFormResultsPage

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

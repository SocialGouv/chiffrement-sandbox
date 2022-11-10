import {
  Box,
  Button,
  Center,
  Heading,
  Link,
  SkeletonText,
  Stack,
} from '@chakra-ui/react'
import { useClientKeys } from 'client/components/ClientProvider'
import { NoSSR } from 'client/components/NoSSR'
import type { NextPage } from 'next'
import NextLink from 'next/link'

const ContactFormsPage: NextPage = () => {
  const buckets = useContactFormNames()
  return (
    <>
      <Heading as="h1" mb={8}>
        Contact forms
      </Heading>
      <NoSSR fallback={<SkeletonText />}>
        {buckets.length === 0 ? (
          <Center>
            Create your first contact form:
            <NextLink href="/app/contact-forms/new" passHref>
              <Button as="a">Create contact form</Button>
            </NextLink>
          </Center>
        ) : (
          <Stack spacing={6}>
            {buckets.map(({ name, submissionBucketId }) => (
              <NextLink
                key={submissionBucketId}
                href={`/app/contact-forms/${submissionBucketId}`}
                passHref
              >
                <Box
                  as={Link}
                  borderWidth="1px"
                  rounded="md"
                  shadow="md"
                  px={4}
                  py={3}
                  _hover={{
                    textDecoration: 'none',
                    shadow: 'lg',
                  }}
                >
                  <Heading as="h2" fontSize="xl">
                    {' '}
                    {name.replace(/^contact-form:/, '')}
                  </Heading>
                </Box>
              </NextLink>
            ))}
            <NextLink href="/app/contact-forms/new" passHref>
              <Button as="a">Create new contact form</Button>
            </NextLink>
          </Stack>
        )}
      </NoSSR>
    </>
  )
}

export default ContactFormsPage

// --

function useContactFormNames() {
  const keys = useClientKeys('name')
  const contactFormNames = Object.entries(keys)
    .filter(([name]) => name.startsWith('contact-form:'))
    .map(([name, keys]) => ({
      name,
      submissionBucketId: keys[0].nameFingerprint,
    }))
  return contactFormNames
}

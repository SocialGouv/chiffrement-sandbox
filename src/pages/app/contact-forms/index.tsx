import {
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
          <Stack spacing={4}>
            {buckets.map(({ name, submissionBucketId }) => (
              <NextLink
                key={submissionBucketId}
                href={`/app/contact-forms/${submissionBucketId}`}
                passHref
              >
                <Link>{name.replace(/^contact-form:/, '')}</Link>
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

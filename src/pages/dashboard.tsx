import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  Link,
  Stack,
  Text,
} from '@chakra-ui/react'
import { AlgorithmBadge } from 'client/components/AlgorithmBadge'
import {
  useClientIdentity,
  useClientKeys,
} from 'client/components/ClientProvider'
import { Identity } from 'client/components/Identity'
import { NoSSR } from 'client/components/NoSSR'
import type { NextPage } from 'next'
import NextLink from 'next/link'
import { FiLogIn, FiPlusCircle } from 'react-icons/fi'

const DashboardPage: NextPage = () => {
  const identity = useClientIdentity()
  const keys = useClientKeys()
  return (
    <>
      <Heading as="h1">Dashboard</Heading>
      <Stack spacing={4} mt={8}>
        <Heading as="h2" fontSize="2xl">
          Identity
        </Heading>
        <NoSSR>
          {identity ? (
            <Identity identity={identity} />
          ) : (
            <Center h={24}>
              <Stack isInline>
                <NextLink href="/signup" passHref>
                  <Button as="a" leftIcon={<>👋</>}>
                    Sign up
                  </Button>
                </NextLink>
                <NextLink href="/login" passHref>
                  <Button as="a" leftIcon={<FiLogIn />}>
                    Log in
                  </Button>
                </NextLink>
              </Stack>
            </Center>
          )}
        </NoSSR>
        <Box />
        <NoSSR>
          <>
            {identity && (
              <Heading as="h2" fontSize="2xl">
                Keys
              </Heading>
            )}
            {Object.entries(keys).map(([name, keys]) => (
              <Flex
                key={name + keys[0]?.createdAt.toISOString()}
                gap={4}
                alignItems="center"
              >
                <AlgorithmBadge algorithm={keys[0].algorithm as any} />
                <NextLink href={`/keys/${name}`} passHref>
                  <Link fontFamily="mono" fontSize="sm" mr="auto">
                    {name}
                  </Link>
                </NextLink>
                <Text
                  as="span"
                  fontSize="xs"
                  color="gray.500"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {keys[0].createdAt.toLocaleString(['se-SE'])}
                </Text>
              </Flex>
            ))}
            {identity && Object.keys(keys).length === 0 && (
              <Center as={Stack} py={4} spacing={4}>
                <Text fontSize="sm" color="gray.500">
                  Your keychain is empty
                </Text>
                <NextLink href="/new-key" passHref>
                  <Button as="a" leftIcon={<FiPlusCircle />}>
                    Create a new key
                  </Button>
                </NextLink>
              </Center>
            )}
          </>
        </NoSSR>
      </Stack>
    </>
  )
}

export default DashboardPage

// --

const KeyView = () => {}

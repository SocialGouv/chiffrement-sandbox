import {
  Flex,
  Heading,
  Icon,
  SkeletonText,
  Stack,
  Text,
} from '@chakra-ui/react'
import { AlgorithmBadge } from 'client/components/AlgorithmBadge'
import { useClientKeys } from 'client/components/ClientProvider'
import { NoSSR } from 'client/components/NoSSR'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { FiLock } from 'react-icons/fi'

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
      </>
    </NoSSR>
  )
}

export default KeyPage

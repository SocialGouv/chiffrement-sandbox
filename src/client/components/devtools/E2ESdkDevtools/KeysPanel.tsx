import {
  Box,
  Button,
  Center,
  Divider,
  Flex,
  Grid,
  Icon,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { AlgorithmBadge } from 'client/components/AlgorithmBadge'
import { useClientKeys } from 'client/components/ClientProvider'
import { useLocalState } from 'client/hooks/useLocalState'
import { KeychainItemMetadata } from 'modules/crypto/client'
import NextLink from 'next/link'
import React from 'react'
import { FiInbox, FiPlusCircle, FiShuffle, FiUsers } from 'react-icons/fi'
import { Section, SectionContainer, SectionHeader } from './components/Sections'

export const KeysPanel: React.FC = () => {
  const allKeys = useClientKeys('nameFingerprint')
  const [selectedKeyFingerprint, setSelectedKeyFingerprint] = useLocalState<
    string | null
  >({
    storageKey: 'e2esdk:devtools:keys:selectedKeyFingerprint',
    defaultValue: null,
  })
  const selectedKeys = selectedKeyFingerprint
    ? allKeys[selectedKeyFingerprint]
    : null
  return (
    <SectionContainer>
      <KeySelectorPanel
        allKeys={allKeys}
        selectedKeyFingerprint={selectedKeyFingerprint}
        setSelectedKeyFingerprint={setSelectedKeyFingerprint}
      />
      <Section>
        {selectedKeys ? (
          <KeyDetailsPanelProps keys={selectedKeys} />
        ) : (
          <Center h="100%" color="gray.500" fontSize="sm">
            Select a key to show its properties
          </Center>
        )}
      </Section>
    </SectionContainer>
  )
}

// --

type KeySelectorPanelProps = {
  allKeys: Record<string, KeychainItemMetadata[]>
  selectedKeyFingerprint: string | null
  setSelectedKeyFingerprint: (selected: string | null) => void
}

const KeySelectorPanel: React.FC<KeySelectorPanelProps> = ({
  allKeys,
  selectedKeyFingerprint,
  setSelectedKeyFingerprint,
}) => {
  return (
    <Section as={Stack} spacing={0} divider={<Divider my={0} />}>
      {Object.entries(allKeys).map(([nameFingerprint, keys]) => (
        <Flex
          px={4}
          py={2}
          cursor="pointer"
          background={
            selectedKeyFingerprint === nameFingerprint
              ? 'gray.50'
              : 'transparent'
          }
          _dark={{
            background:
              selectedKeyFingerprint === nameFingerprint
                ? 'gray.800'
                : 'transparent',
          }}
          key={nameFingerprint + keys[0]?.createdAt.toISOString()}
          borderLeftWidth="3px"
          borderLeftColor={
            selectedKeyFingerprint === nameFingerprint
              ? 'green.500'
              : 'transparent'
          }
          gap={4}
          alignItems="center"
          onClick={() =>
            setSelectedKeyFingerprint(
              nameFingerprint === selectedKeyFingerprint
                ? null
                : nameFingerprint
            )
          }
        >
          <Icon
            color="gray.500"
            as={
              keys[0].algorithm === 'secretBox'
                ? FiUsers
                : keys[0].algorithm === 'sealedBox'
                ? FiInbox
                : FiShuffle
            }
            title={keys[0].algorithm}
            aria-label={keys[0].algorithm}
          />
          <Box flex={1}>
            <Text fontFamily="mono" fontSize="sm">
              {keys[0].name}
            </Text>
            <Text fontFamily="mono" fontSize="xs" color="gray.500">
              {keys[0].nameFingerprint}
            </Text>
          </Box>
        </Flex>
      ))}
      {Object.keys(allKeys).length === 0 && (
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
    </Section>
  )
}

// --

type KeyDetailsPanelProps = {
  keys: KeychainItemMetadata[]
}

const KeyDetailsPanelProps: React.FC<KeyDetailsPanelProps> = ({ keys }) => {
  const currentKey = keys[0]
  if (!currentKey) {
    return (
      <Center h="100%" color="gray.500" fontSize="sm">
        Key set is empty
      </Center>
    )
  }
  return (
    <>
      <SectionHeader mt={0}>Metadata</SectionHeader>
      <Grid
        templateColumns="8rem 1fr"
        px={4}
        rowGap={2}
        fontSize="sm"
        alignItems="center"
      >
        <Text fontWeight="semibold">Algorithm</Text>
        <AlgorithmBadge algorithm={currentKey.algorithm} />
        <Text fontWeight="semibold">Fingerprint</Text>
        <Text fontFamily="mono" color="gray.500">
          {currentKey.payloadFingerprint}
        </Text>
        {currentKey.publicKey && (
          <>
            <Text fontWeight="semibold">Public key</Text>
            <Text fontFamily="mono" color="gray.500">
              {currentKey.publicKey}
            </Text>
          </>
        )}
        <Text fontWeight="semibold">Created</Text>
        <Text fontFamily="mono" color="gray.500">
          {currentKey.createdAt.toLocaleString(['se-SE'])}
        </Text>
        <Text fontWeight="semibold">Expires</Text>
        <Text fontFamily="mono" color="gray.500">
          {currentKey.expiresAt?.toLocaleString(['se-SE']) ?? <em>never</em>}
        </Text>
        <Text fontWeight="semibold">Shared from</Text>
        <Text fontFamily="mono" color="gray.500">
          {currentKey.sharedBy ?? <em>null</em>}
        </Text>
      </Grid>
      {keys.length > 1 && (
        <>
          <SectionHeader>Previous Keys</SectionHeader>
          <TableContainer>
            <Table size="sm" mt={-2}>
              <Thead>
                <Tr>
                  <Th>Fingerprint</Th>
                  {currentKey.publicKey && <Th>Public Key</Th>}
                  <Th>Created</Th>
                  <Th>Expires</Th>
                  <Th>Shared from</Th>
                </Tr>
              </Thead>
              <Tbody
                color="gray.500"
                fontSize="xs"
                sx={{
                  '& td': {
                    fontSize: 'xs',
                  },
                }}
              >
                {keys.slice(1).map(key => (
                  <Tr key={key.createdAt.toISOString()} fontFamily="mono">
                    <Td>{key.payloadFingerprint}</Td>
                    {key.publicKey && <Td>{key.publicKey}</Td>}
                    <Td>{key.createdAt.toLocaleString(['se-SE'])}</Td>
                    <Td>
                      {key.expiresAt?.toLocaleString(['se-SE']) ?? (
                        <em>never</em>
                      )}
                    </Td>
                    <Td>{key.sharedBy ?? <em>null</em>}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </>
      )}
    </>
  )
}

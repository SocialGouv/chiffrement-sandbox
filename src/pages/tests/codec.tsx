import { Button, Heading, Text } from '@chakra-ui/react'
import type { NextPage } from 'next'
import { useClient } from '../../client/components/ClientProvider'
import type { Client } from '../../modules/crypto/client'
import { base64UrlDecode, base64UrlEncode } from '../../modules/crypto/codec'

const CodecTestPage: NextPage = () => {
  const client = useClient()
  return (
    <>
      <Heading as="h1">Codec</Heading>
      <Button onClick={() => runTest(client)}>Run Test</Button>
      <Text fontSize="sm" color="gray.500" fontStyle="italic">
        Check the console
      </Text>
    </>
  )
}

export default CodecTestPage

function runTest(client: Client) {
  function check<T extends string | Uint8Array>(
    context: string,
    expected: T,
    received: T
  ) {
    if (typeof expected !== typeof received) {
      throw new Error('mismatching types')
    }
    if (expected.length !== received.length) {
      console.error(`❌ ${context}
  Expected ${expected.length} elements: ${expected}
  Received ${received.length} elements: ${received}
`)
      return
    }
    if (typeof expected === 'string' && typeof received === 'string') {
      if (expected !== received) {
        console.error(`❌ ${context}
    Expected ${expected}
    Received ${received}
  `)
        return
      }
    }
    if (typeof expected === 'object' && typeof received === 'object') {
      if (!received.every((byte, i) => byte === expected[i])) {
        console.error(`❌ ${context}
    Expected ${expected}
    Received ${received}
  `)
        return
      }
    }

    console.info(`✅ ${context}`)
  }

  Array.from({ length: 32 }, (_, i) => i).forEach(bufferSize => {
    const buffer = client.sodium.randombytes_buf(bufferSize)
    // Ensure we have the special two chars
    buffer[0] = 0xff
    buffer[2] = 0xfe
    const b64Sodium = client.sodium.to_base64(buffer)
    const ctx = (index: number) => `Buffer size ${bufferSize} - Test ${index}`
    //   console.info(
    //     `Buffer size ${bufferSize}
    // sodium: ${b64Sodium}
    // codec:  ${base64UrlEncode(buffer)}`
    //   )
    check(ctx(1), base64UrlDecode(base64UrlEncode(buffer)), buffer)
    check(ctx(2), base64UrlEncode(base64UrlDecode(b64Sodium)), b64Sodium)
    check(ctx(3), base64UrlEncode(buffer), client.sodium.to_base64(buffer))
    check(
      ctx(4),
      base64UrlDecode(b64Sodium),
      client.sodium.from_base64(b64Sodium)
    )
  })
}

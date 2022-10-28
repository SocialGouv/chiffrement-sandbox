import { ChakraProvider } from '@chakra-ui/react'
import { ClientProvider } from 'client/components/ClientProvider'
import { PageLayout } from 'client/components/pageLayout'
import type { AppProps } from 'next/app'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ClientProvider>
      <ChakraProvider>
        <PageLayout>
          <Component {...pageProps} />
        </PageLayout>
      </ChakraProvider>
    </ClientProvider>
  )
}

export default MyApp

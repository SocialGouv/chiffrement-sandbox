import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ClientProvider } from 'client/components/ClientProvider'
import { PageLayout } from 'client/components/pageLayout'
import type { AppProps } from 'next/app'

const reactQueryClient = new QueryClient()

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={reactQueryClient}>
      <ClientProvider>
        <ChakraProvider>
          <PageLayout>
            <Component {...pageProps} />
          </PageLayout>
          <ReactQueryDevtools initialIsOpen={false} />
        </ChakraProvider>
      </ClientProvider>
    </QueryClientProvider>
  )
}

export default MyApp

import { ChakraProvider, HStack } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ClientProvider } from 'client/components/ClientProvider'
import { ColorModeSwitch } from 'client/components/colorModeSwitch'
import { E2ESdkDevtools } from 'client/components/devtools/E2ESdkDevtools'
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
          <HStack position="fixed" zIndex="overlay" bottom={3} left={16}>
            <ReactQueryDevtools
              initialIsOpen={false}
              position="bottom-left"
              toggleButtonProps={{
                style: {
                  zIndex: 'var(--chakra-zIndices-overlay)' as any,
                },
              }}
            />
            <E2ESdkDevtools />
            <ColorModeSwitch />
          </HStack>
        </ChakraProvider>
      </ClientProvider>
    </QueryClientProvider>
  )
}

export default MyApp

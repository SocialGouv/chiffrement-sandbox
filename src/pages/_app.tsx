import { ChakraProvider } from '@chakra-ui/react'
import { PageLayout } from 'components/pageLayout'
import type { AppProps } from 'next/app'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider>
      <PageLayout>
        <Component {...pageProps} />
      </PageLayout>
    </ChakraProvider>
  )
}

export default MyApp

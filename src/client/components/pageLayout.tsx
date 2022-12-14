import {
  Container,
  Flex,
  FlexProps,
  Icon,
  IconButton,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Stack,
  Text,
} from '@chakra-ui/react'
import { ColorModeSwitch } from 'client/components/colorModeSwitch'
import { SodiumState } from 'client/components/sodiumState'
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import {
  FiLock,
  FiLogOut,
  FiPenTool,
  FiPlusCircle,
  FiShare2,
  FiUser,
} from 'react-icons/fi'
import { MdOutlineLock } from 'react-icons/md'
import { useClient, useClientIdentity } from './ClientProvider'
import { NoSSR } from './NoSSR'

type PageLayoutProps = FlexProps & {
  children: React.ReactNode
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  ...props
}) => {
  const client = useClient()
  const identity = useClientIdentity()
  const router = useRouter()

  if (router.asPath.startsWith('/contact-form')) {
    return (
      <>
        <Flex
          as="header"
          py={2}
          px={4}
          gap={2}
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          rowGap={2}
        >
          <Text fontWeight="semibold">
            <Icon as={MdOutlineLock} mr={1} transform="translateY(2px)" />
            e2e SDK Demo
          </Text>
          <ColorModeSwitch />
        </Flex>

        <Container maxW="5xl" my={8}>
          {children}
        </Container>
      </>
    )
  }

  const containerWidth =
    router.asPath.startsWith('/app/contact-forms/') &&
    !router.asPath.endsWith('/new')
      ? '8xl'
      : '2xl'

  return (
    <>
      <Flex
        py={2}
        px={4}
        gap={2}
        alignItems="center"
        flexWrap="wrap"
        rowGap={2}
        {...props}
      >
        <NextLink href="/app/contact-forms" passHref>
          <Link>
            <Text fontWeight="semibold">
              <Icon as={MdOutlineLock} mr={1} transform="translateY(2px)" />
              e2e SDK Demo
            </Text>
          </Link>
        </NextLink>

        <Stack
          as="nav"
          isInline
          spacing={8}
          ml={8}
          fontWeight="semibold"
          fontSize="small"
        >
          <NextLink href="/new-key" passHref>
            <Link
              textDecoration={
                router.asPath === '/new-key' ? 'underline' : undefined
              }
            >
              <Icon as={FiPlusCircle} mr={1.5} transform="translateY(2px)" />
              New key
            </Link>
          </NextLink>
          <NextLink href="/share-key" passHref>
            <Link
              textDecoration={
                router.asPath === '/share-key' ? 'underline' : undefined
              }
            >
              <Icon as={FiShare2} mr={1.5} transform="translateY(2px)" />
              Share key
            </Link>
          </NextLink>
        </Stack>
        <Stack isInline marginLeft="auto" alignItems="center">
          <SodiumState />
          <ColorModeSwitch />
          <Menu>
            <MenuButton
              as={IconButton}
              icon={<FiUser />}
              rounded="full"
              variant="ghost"
              aria-label="User settings"
            />
            <MenuList>
              <NoSSR>
                {identity ? (
                  <>
                    <MenuItem icon={<FiUser />}>
                      <Text as="span" fontFamily="mono" fontSize="xs">
                        {identity.userId}
                      </Text>
                    </MenuItem>
                    <MenuItem icon={<FiLock />}>
                      <Text as="span" fontFamily="mono" fontSize="xs">
                        {client.encode(identity.sharingPublicKey)}
                      </Text>
                    </MenuItem>
                    <MenuItem icon={<FiPenTool />}>
                      <Text as="span" fontFamily="mono" fontSize="xs">
                        {client.encode(identity.signaturePublicKey)}
                      </Text>
                    </MenuItem>
                    <MenuItem
                      icon={<FiLogOut />}
                      color="red.500"
                      onClick={() => {
                        client.logout()
                        router.push('/login')
                      }}
                    >
                      Log out
                    </MenuItem>
                  </>
                ) : (
                  <>
                    <NextLink href="/login" passHref>
                      <MenuItem as="a" display="block">
                        Log in
                      </MenuItem>
                    </NextLink>
                    <NextLink href="/signup" passHref>
                      <MenuItem as="a" display="block">
                        Sign up
                      </MenuItem>
                    </NextLink>
                  </>
                )}
              </NoSSR>
            </MenuList>
          </Menu>
        </Stack>
      </Flex>
      <Container maxW={containerWidth} my={8}>
        {children}
      </Container>
    </>
  )
}

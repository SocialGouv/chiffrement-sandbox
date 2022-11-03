import {
  Container,
  Flex,
  FlexProps,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
} from '@chakra-ui/react'
import { ColorModeSwitch } from 'client/components/colorModeSwitch'
import { SodiumState } from 'client/components/sodiumState'
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import React from 'react'
import { FiLock, FiLogOut, FiPenTool, FiUser } from 'react-icons/fi'
import { TbSalt } from 'react-icons/tb'
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
  return (
    <>
      <Flex py={2} px={4} gap={2} alignItems="center" {...props}>
        <Text fontWeight="semibold">
          <Icon as={TbSalt} mr={1} transform="translateY(2px)" />
          Sodium Sandbox
        </Text>
        <SodiumState marginLeft="auto" />
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
      </Flex>
      <Container maxW="2xl" my={8}>
        {children}
      </Container>
    </>
  )
}

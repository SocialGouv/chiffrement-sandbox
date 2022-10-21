import { Container, Flex, FlexProps, Icon, Text } from '@chakra-ui/react'
import { ColorModeSwitch } from 'components/colorModeSwitch'
import { SodiumState } from 'components/sodiumState'
import React from 'react'
import { TbSalt } from 'react-icons/tb'

type PageLayoutProps = FlexProps & {
  children: React.ReactNode
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  ...props
}) => {
  return (
    <>
      <Flex py={2} px={4} gap={2} alignItems="center" {...props}>
        <Text fontWeight="semibold">
          <Icon as={TbSalt} mr={1} transform="translateY(2px)" />
          Sodium Sandbox
        </Text>
        <SodiumState marginLeft="auto" />
        <ColorModeSwitch />
      </Flex>
      <Container maxW="2xl" my={8}>
        {children}
      </Container>
    </>
  )
}

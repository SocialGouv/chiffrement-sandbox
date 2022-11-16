import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  Flex,
  Icon,
  IconButton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react'
import { useClientIdentity } from 'client/components/ClientProvider'
import { LoginForm } from 'client/components/LoginForm'
import { useLocalState } from 'client/hooks/useLocalState'
import React from 'react'
import { FiKey, FiLogIn, FiUser } from 'react-icons/fi'
import { MdOutlineLock } from 'react-icons/md'
import { ColorModeSwitch } from '../../colorModeSwitch'
import { IdentityPanel } from './IdentityPanel'
import { KeysPanel } from './KeysPanel'

export const E2ESdkDevtools: React.FC = ({ ...props }) => {
  const identity = useClientIdentity()
  const { isOpen, onClose, onToggle: toggleOpen } = useDisclosure()
  const [tabIndex, setTabIndex] = useLocalState({
    storageKey: 'e2esdk:devtools:tabIndex',
    defaultValue: 0,
  })
  return (
    <>
      <Tooltip label="e2e SDK Devtools" isDisabled={isOpen}>
        <IconButton
          variant="ghost"
          aria-label="e2e SDK Devtools"
          icon={<MdOutlineLock />}
          isRound
          onMouseDown={toggleOpen}
          position="relative"
          {...props}
        />
      </Tooltip>
      <Drawer
        isOpen={isOpen}
        placement="bottom"
        onClose={onClose}
        allowPinchZoom
      >
        <DrawerContent
          _dark={{
            bg: 'gray.900',
          }}
          shadow="dark-lg"
        >
          <Tabs index={tabIndex} onChange={setTabIndex}>
            <ColorModeSwitch position="absolute" top="1px" right={12} />
            <DrawerCloseButton rounded="full" mt="-3px" />
            <DrawerHeader
              as={Flex}
              borderBottomWidth="1px"
              alignItems="center"
              py={0}
              pl="18.5px"
              fontSize="lg"
            >
              <Icon as={MdOutlineLock} mr={2} />
              <Text>e2e SDK</Text>
              <TabList ml={8}>
                {identity ? (
                  <>
                    <Tab>
                      <Icon as={FiUser} mr={2} />
                      Identity
                    </Tab>
                    <Tab>
                      <Icon as={FiKey} mr={2} />
                      Keys
                    </Tab>
                  </>
                ) : (
                  <Tab>
                    <Icon as={FiLogIn} mr={2} />
                    Log in
                  </Tab>
                )}
              </TabList>
            </DrawerHeader>
            <DrawerBody
              px={2}
              pt={0}
              pb={4}
              overflow="auto"
              h="50vh"
              position="relative"
            >
              {identity ? (
                <TabPanels>
                  <TabPanel px={2}>
                    <IdentityPanel />
                  </TabPanel>
                  <TabPanel>
                    <KeysPanel />
                  </TabPanel>
                </TabPanels>
              ) : (
                <TabPanels>
                  <TabPanel>
                    <LoginForm />
                  </TabPanel>
                </TabPanels>
              )}
            </DrawerBody>
          </Tabs>
        </DrawerContent>
      </Drawer>
    </>
  )
}

import { Badge, BadgeProps, Icon, useBoolean } from '@chakra-ui/react'
import React from 'react'
import { FiCheckCircle, FiLoader } from 'react-icons/fi'
import { ready } from '../../modules/crypto/sodium'

export const SodiumState: React.FC<BadgeProps> = props => {
  const [isReady, { on: setReady }] = useBoolean(false)
  React.useEffect(() => {
    ready.then(setReady)
  }, [setReady])
  return (
    <Badge
      h={5}
      colorScheme={isReady ? 'green' : 'orange'}
      textTransform="none"
      rounded="full"
      pr={2}
      display="flex"
      alignItems="center"
      {...props}
    >
      <Icon as={isReady ? FiCheckCircle : FiLoader} mr={1} />
      Sodium {isReady ? 'ready' : 'loading'}
    </Badge>
  )
}

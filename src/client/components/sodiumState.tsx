import { Badge, BadgeProps, Box, useBoolean } from '@chakra-ui/react'
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
      <Box as={isReady ? FiCheckCircle : FiLoader} display="inline" mr={1} />
      Sodium {isReady ? 'ready' : 'loading'}
    </Badge>
  )
}

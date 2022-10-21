import { Badge, BadgeProps, Box, useBoolean } from '@chakra-ui/react'
import React from 'react'
import { FiCheckCircle, FiLoader } from 'react-icons/fi'
import { ready } from '../lib/sodium'

export const SodiumState: React.FC<BadgeProps> = (props) => {
  const [isReady, { on: setReady }] = useBoolean(false)
  React.useEffect(() => {
    ready.then(setReady)
  }, [setReady])
  return (
    <Badge
      colorScheme={isReady ? 'green' : 'orange'}
      textTransform="none"
      rounded="full"
      pr={2}
      {...props}
    >
      <Box
        as={isReady ? FiCheckCircle : FiLoader}
        display="inline"
        mr={1}
        transform="translateY(1.5px)"
      />
      Sodium {isReady ? 'ready' : 'loading'}
    </Badge>
  )
}

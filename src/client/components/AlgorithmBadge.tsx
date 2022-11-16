import { Badge, BadgeProps } from '@chakra-ui/react'
import { cipherParser } from 'modules/crypto/ciphers'
import React from 'react'

type AlgorithmBadgeProps = BadgeProps & {
  algorithm: typeof cipherParser._type.algorithm
}

export const AlgorithmBadge: React.FC<AlgorithmBadgeProps> = ({
  algorithm,
  ...props
}) => {
  return (
    <Badge
      w="4.5rem"
      h="1.2rem"
      textTransform="none"
      textAlign="center"
      colorScheme={
        algorithm === 'box'
          ? 'orange'
          : algorithm === 'sealedBox'
          ? 'green'
          : 'purple'
      }
      {...props}
    >
      {algorithm}
    </Badge>
  )
}

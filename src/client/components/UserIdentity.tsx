import {
  FormControl,
  FormControlProps,
  FormHelperText,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Spinner,
} from '@chakra-ui/react'
import { PublicUserIdentity } from 'modules/crypto/client'
import React from 'react'
import { useClient } from './ClientProvider'

type UserIdentityProps = FormControlProps & {
  label?: string
  identity: PublicUserIdentity | null
  onIdentityChange: (identity: PublicUserIdentity | null) => void
}

export const UserIdentity: React.FC<UserIdentityProps> = ({
  label = 'User ID',
  identity,
  onIdentityChange,
  ...props
}) => {
  const client = useClient()
  const [userId, setUserId] = React.useState(identity?.userId ?? '')
  const [isLoading, setIsLoading] = React.useState(false)
  const [publicKey, setPublicKey] = React.useState<string | null>(null)

  const fetchIdentity = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const identity = await client.getUserIdentity(userId)
      onIdentityChange(identity)
      setPublicKey(
        identity?.signaturePublicKey
          ? client.encode(identity.signaturePublicKey)
          : null
      )
    } finally {
      setIsLoading(false)
    }
  }, [client, userId, onIdentityChange])

  return (
    <FormControl {...props}>
      <FormLabel>{label}</FormLabel>
      <InputGroup>
        <Input
          value={userId}
          onChange={e => setUserId(e.target.value)}
          onBlur={fetchIdentity}
        />
        <InputRightElement>{isLoading && <Spinner />}</InputRightElement>
      </InputGroup>
      {publicKey && <FormHelperText>Public key: {publicKey}</FormHelperText>}
    </FormControl>
  )
}

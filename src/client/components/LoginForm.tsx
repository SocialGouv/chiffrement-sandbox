import {
  Button,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Stack,
  StackProps,
} from '@chakra-ui/react'
import { useClient } from 'client/components/ClientProvider'
import { generateSecretBoxCipher } from 'modules/crypto/ciphers'
import { PublicUserIdentity } from 'modules/crypto/client'
import React from 'react'
import { useForm } from 'react-hook-form'
import { FiLogIn, FiRefreshCw } from 'react-icons/fi'
import { z } from 'zod'

type LoginFormProps = StackProps & {
  onLogin?: (identity: PublicUserIdentity) => Promise<any> | void
}

const formSchema = z.object({
  userId: z.string(),
  personalKey: z.string(),
})

type FormValues = z.infer<typeof formSchema>

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin, ...props }) => {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>()
  const client = useClient()
  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      await client.login(values.userId, client.decode(values.personalKey))
      await onLogin?.(client.publicIdentity)
    },
    [client, onLogin]
  )
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={4} {...props}>
        <FormControl>
          <FormLabel>User ID</FormLabel>
          <InputGroup>
            <Input fontFamily="mono" {...register('userId')} />
            <InputRightElement>
              <IconButton
                aria-label="Randomize"
                icon={<FiRefreshCw />}
                onClick={() => setValue('userId', window.crypto.randomUUID())}
                rounded="full"
                variant="ghost"
              />
            </InputRightElement>
          </InputGroup>
        </FormControl>
        <FormControl>
          <FormLabel>Personal Key</FormLabel>
          <InputGroup>
            <Input fontFamily="mono" {...register('personalKey')} />
            <InputRightElement>
              <IconButton
                aria-label="Randomize"
                icon={<FiRefreshCw />}
                onClick={() =>
                  setValue(
                    'personalKey',
                    client.encode(generateSecretBoxCipher(client.sodium).key)
                  )
                }
                rounded="full"
                variant="ghost"
              />
            </InputRightElement>
          </InputGroup>
        </FormControl>
        <Button type="submit" isLoading={isSubmitting} leftIcon={<FiLogIn />}>
          Log in
        </Button>
      </Stack>
    </form>
  )
}

import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  SimpleGrid,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Stack,
  Text,
} from '@chakra-ui/react'
import { sodium } from 'client/lib/sodium'
import type { NextPage } from 'next'
import { queryTypes, useQueryState } from 'next-usequerystate'
import prettyBytes from 'pretty-bytes'
import prettyMs from 'pretty-ms'
import React from 'react'
import { FiRefreshCw } from 'react-icons/fi'

type State = {
  isRunning: boolean
  output?: string
  processingTime?: number
}

const initialState: State = {
  isRunning: false,
}

type Actions =
  | { type: 'process' }
  | { type: 'result'; output: string; processingTime: number }

const reducer: React.Reducer<State, Actions> = (state, action) => {
  if (action.type === 'process') {
    return {
      ...state,
      isRunning: true,
    }
  }
  if (action.type === 'result') {
    return {
      isRunning: false,
      ...action,
    }
  }
  return state
}

const noScroll = {
  scroll: false,
}

const KeyDerivationTestPage: NextPage = () => {
  const [{ isRunning, output, processingTime }, dispatch] = React.useReducer(
    reducer,
    initialState
  )
  const [input, setInput] = useQueryState(
    'input',
    queryTypes.string.withDefault('')
  )
  const [memorySize, setMemorySize] = useQueryState(
    'memorySize',
    queryTypes.integer.withDefault(25)
  )
  const [computationComplexity, setComputationComplexity] = useQueryState(
    'complexity',
    queryTypes.integer.withDefault(5)
  )
  const [algorithm, setAlgorithm] = useQueryState(
    'algorithm',
    queryTypes.integer.withDefault(2)
  )
  const [salt, setSalt] = useQueryState(
    'salt',
    queryTypes.string.withDefault('00000000000000000000000000000000')
  )
  const [keySize, setKeySize] = useQueryState(
    'keySize',
    queryTypes.integer.withDefault(32)
  )

  const onClick = React.useCallback(async () => {
    dispatch({ type: 'process' })
    const tick = performance.now()
    const { worker } = await import('client/workers/keyDerivation.controller')
    const key = await worker(
      keySize,
      input,
      salt,
      computationComplexity,
      1 << memorySize,
      algorithm
    )
    const tock = performance.now()
    dispatch({
      type: 'result',
      output: key,
      processingTime: tock - tick,
    })
  }, [input, keySize, memorySize, computationComplexity, algorithm, salt])

  return (
    <>
      <Heading as="h1">Key Derivation</Heading>
      <Stack spacing={4} mt={8}>
        <FormControl>
          <FormLabel>Input</FormLabel>
          <Input
            value={input}
            onChange={e => setInput(e.target.value, noScroll)}
          />
        </FormControl>
        <FormControl>
          <FormLabel>Salt</FormLabel>
          <InputGroup>
            <Input
              fontFamily="mono"
              value={salt}
              onChange={e => setSalt(e.target.value, noScroll)}
            />
            <InputRightElement>
              <IconButton
                aria-label="Randomize"
                icon={<FiRefreshCw />}
                onClick={() =>
                  setSalt(
                    sodium.randombytes_buf(
                      sodium.crypto_pwhash_SALTBYTES,
                      'hex'
                    ),
                    noScroll
                  )
                }
                rounded="full"
                variant="ghost"
              />
            </InputRightElement>
          </InputGroup>
        </FormControl>
      </Stack>
      <Text fontWeight="bold" fontSize="lg" mt={8} mb={4}>
        Algorithm Settings
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} columnGap={12} rowGap={4}>
        <FormControl>
          <FormLabel>Computation Complexity</FormLabel>
          <Slider
            min={1}
            max={20}
            value={computationComplexity}
            onChange={value => setComputationComplexity(value, noScroll)}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
          <FormHelperText textAlign="right">
            {computationComplexity}
          </FormHelperText>
        </FormControl>
        <FormControl>
          <FormLabel>Memory usage</FormLabel>
          <Slider
            min={8}
            max={30}
            value={memorySize}
            onChange={value => setMemorySize(value, noScroll)}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
          <FormHelperText textAlign="right">
            {prettyBytes(1 << memorySize, { binary: true })}
          </FormHelperText>
        </FormControl>
        <FormControl>
          <FormLabel>Algorithm</FormLabel>
          <Select
            value={algorithm}
            onChange={e => setAlgorithm(parseInt(e.target.value), noScroll)}
          >
            <option value={1}>Argon2i (1.3)</option>
            <option value={2}>Argon2id (1.3)</option>
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>Output key size</FormLabel>
          <NumberInput
            min={8}
            max={256}
            step={8}
            value={keySize}
            onChange={(_, value) => setKeySize(value, noScroll)}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </FormControl>
      </SimpleGrid>
      <Stack spacing={4} mt={8}>
        <Button onClick={onClick} isLoading={isRunning}>
          Compute Derived Key
        </Button>
        <Text fontFamily="mono" fontSize="lg" textAlign="center">
          {output}
        </Text>
        {Boolean(processingTime) && (
          <Text fontSize="sm" color="gray.500" textAlign="center">
            Generated in{' '}
            {prettyMs(processingTime!, {
              formatSubMilliseconds: true,
            })}
          </Text>
        )}
      </Stack>
    </>
  )
}

export default KeyDerivationTestPage

import {
  Box,
  BoxProps,
  Flex,
  FlexProps,
  forwardRef,
  Heading,
  HeadingProps,
} from '@chakra-ui/react'

export const SectionContainer = (props: FlexProps) => {
  return <Flex position="absolute" inset={0} {...props} />
}

export const Section = forwardRef<BoxProps, 'section'>((props, ref) => (
  <Box
    as="section"
    flex={1}
    overflow="auto"
    sx={{
      '&:not(:first-child)': {
        borderLeftWidth: '1px',
      },
    }}
    ref={ref}
    {...props}
  />
))

type SectionHeaderProps = HeadingProps & {
  children: React.ReactNode
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  children,
  ...props
}) => {
  return (
    <Heading
      as="h3"
      fontSize="md"
      px={4}
      py={2}
      my={4}
      bg="gray.50"
      _dark={{
        bg: 'gray.800',
        ...props._dark,
      }}
      {...props}
    >
      {children}
    </Heading>
  )
}

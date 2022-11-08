import { z } from 'zod'

const foo = z.object({
  type: z.literal('foo'),
  foo: z.number(),
})

const bar = z.object({
  type: z.literal('bar'),
  bar: z.string(),
})

const union = z.discriminatedUnion('type', [foo, bar])

const baz = z.object({
  type: z.literal(union._type[union.discriminator]),
})

baz.parse({ baz: 'foo' }) // ok
baz.parse({ baz: 'nope' }) // parse error

type Baz = z.infer<typeof baz>
// {
//   baz: 'foo' | 'bar'
// }

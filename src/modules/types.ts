export type Require<
  Object extends object,
  Keys extends keyof Object
> = Required<Pick<Object, Keys>> & Omit<Object, Keys>

export type Optional<
  Object extends object,
  Keys extends keyof Object
> = Partial<Pick<Object, Keys>> & Omit<Object, Keys>

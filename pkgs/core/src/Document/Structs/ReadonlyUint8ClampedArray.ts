export type ReadonlyUint8ClampedArray = Omit<
  Readonly<Uint8ClampedArray>,
  'set' | 'fill' | 'reverse' | 'sort' | number
> &
  readonly number[]

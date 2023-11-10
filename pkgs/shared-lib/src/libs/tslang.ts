export const unreachable = (x: never) => {
  throw new Error(`Unreachable: ${x}`)
}

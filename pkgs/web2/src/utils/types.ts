export type Requires<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: T[P]
}

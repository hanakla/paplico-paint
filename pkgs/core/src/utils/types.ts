export type Requiring<T extends object, U extends keyof T> = T & {
  [K in U]-?: T[K]
}

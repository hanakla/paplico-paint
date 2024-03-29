import clone from 'clone'

// prettier-ignore
type RemoveReadonly<T> =
  T extends ReadonlyArray<infer R> ? Array<R>
  : T extends object ? { -readonly [K in keyof T]: T[K] }
  : T

export const deepClone = <T>(obj: T): RemoveReadonly<T> =>
  clone(obj, false) as any

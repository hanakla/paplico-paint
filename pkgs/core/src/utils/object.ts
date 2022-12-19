import { klona } from 'klona'

export const hasOwnKey = <T extends object>(obj: T, key: keyof T) => {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

// prettier-ignore
type RemoveReadonly<T> =
  T extends object? { -readonly [K in keyof T]: T[K] }
  : T extends ReadonlyArray<infer R> ? Array<R>
  : T

export const deepClone = <T>(obj: T): RemoveReadonly<T> => klona(obj) as any

export const assign = <T extends object>(obj: T, patch: Partial<T>) =>
  Object.assign(obj, patch) as T

export const pick = <T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): { [KK in K]: T[KK] } => {
  return keys.reduce((acc, k) => {
    return hasOwnKey(obj, k) ? assign(acc, { [k]: obj[k] }) : acc
  }, Object.create(null))
}

interface Merger {
  <T1, T2>(obj1: T1, obj2: T2): T1 & T2
  <T1, T2, T3>(obj1: T1, obj2: T2, obj3: T3): T1 & T2 & T3
  <T1, T2, T3, T4>(obj1: T1, obj2: T2, obj3: T3, obj4: T4): T1 & T2 & T3 & T4
}

export const mergeToNew: Merger = (...obj: any[]) => {
  return Object.assign({}, ...obj)
}

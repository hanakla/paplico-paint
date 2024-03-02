import { klona } from 'klona'

export const hasOwnKey = <T extends object>(obj: T, key: keyof T) => {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export const assign = <T extends object>(obj: T, patch: Partial<T>) =>
  Object.assign(obj, patch) as T

interface Merger {
  <T1, T2>(obj1: T1, obj2: T2): T1 & T2
  <T1, T2, T3>(obj1: T1, obj2: T2, obj3: T3): T1 & T2 & T3
  <T1, T2, T3, T4>(obj1: T1, obj2: T2, obj3: T3, obj4: T4): T1 & T2 & T3 & T4
}

export const mergeToNew: Merger = (...obj: any[]) => {
  return Object.assign({}, ...obj)
}

export const deepCloneAndUpdate = <T>(
  t: T,
  updater: (t: RemoveReadonly<T>) => void,
) => {
  const clone = deepClone(t)
  updater(clone)
  return clone
}

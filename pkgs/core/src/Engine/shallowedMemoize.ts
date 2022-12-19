import { equal } from 'fast-shallow-equal'

const cache = new WeakMap<any, { key: any; value: any }>()

export const shallowEqMemoize = <
  T extends (...args: any[]) => any,
  K extends object
>(
  key: (...args: Parameters<T>) => K,
  process: T
) => {
  return (...args: Parameters<T>) => {
    const keyObj = key(...args)
    const cached = cache.get(keyObj)

    if (cached) {
      if (equal(cached.key, keyObj)) return cached.value
    }

    const fresh = process(...args)
    cache.set(keyObj, { key: { ...keyObj }, value: fresh })
    return fresh
  }
}

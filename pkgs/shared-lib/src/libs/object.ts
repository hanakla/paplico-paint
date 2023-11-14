import { klona } from 'klona'

// prettier-ignore
type RemoveReadonly<T> =
  T extends object? { -readonly [K in keyof T]: T[K] }
  : T extends ReadonlyArray<infer R> ? Array<R>
  : T

export const deepClone = <T>(obj: T): RemoveReadonly<T> => klona(obj) as any

export const assign = <T extends object>(obj: T, patch: Partial<T>) =>
  Object.assign(obj, patch)

export const shallowEquals = (prev: any, next: any) => {
  if (Object.is(prev, next)) return true
  if (typeof prev !== typeof next) return false

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) return false

    for (const idx in prev) {
      if (!Object.is(prev[idx], next[idx])) return false
    }

    return true
  }

  if (
    typeof prev === 'object' &&
    typeof next === 'object' &&
    prev !== null &&
    next !== null
  ) {
    if (Object.keys(prev).length !== Object.keys(next).length) return false

    for (const key in prev) {
      if (!Object.hasOwn(next, key)) continue
      if (!Object.is(prev[key], next[key])) return false
    }

    return true
  }

  return false
}

export const mapEntries = <T, R>(
  obj: Record<string, T>,
  mapper: (entry: [string, T]) => R,
): R[] => {
  const result: R[] = []

  for (const [k, v] of Object.entries(obj)) {
    result.push(mapper([k, v]))
  }

  return result
}

export const pick = <T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> => {
  const result = {} as any

  for (const key of keys) {
    result[key] = (obj as any)?.[key] ?? null
  }

  return result
}

export const omit = <T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> => {
  const result = { ...obj } as any

  for (const key of keys) {
    delete result[key]
  }

  return result
}

export const changedKeys = (
  prev: Record<string, any>,
  values: Record<string, any>,
) => {
  const changed: string[] = []

  for (const [k, v] of Object.entries(values)) {
    if (!Object.is(v, prev[k])) changed.push(k)
  }

  return changed
}

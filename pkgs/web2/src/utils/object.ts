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
    for (const key in prev) {
      if (!Object.hasOwn(next, key)) continue
      if (!Object.is(prev[key], next[key])) return false
    }

    return true
  }

  return false
}

export const pick = <
  T extends object | null | undefined,
  K extends keyof Exclude<T, null | undefined>,
>(
  obj: T,
  keys: K[],
): T extends null | undefined
  ? { [KK in K]: null }
  : Pick<Exclude<T, null | undefined>, K> => {
  const result = {} as any

  for (const key of keys) {
    result[key] = (obj as any)?.[key] ?? null
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

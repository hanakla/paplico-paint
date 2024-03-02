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

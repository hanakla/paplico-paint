import { DependencyList, useMemo, useReducer } from 'react'

export function useMemoRevailidatable<T extends any>(
  factory: () => T,
  deps: DependencyList,
) {
  const [id, revalidate] = useReducer((s) => s + 1, 0)
  const value = useMemo<T>(factory, [id, ...deps])

  return [value, revalidate] as const
}

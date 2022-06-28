export const reversedIndex = (array: readonly any[], index: number) => {
  return array.length - 1 - index
}

export const uniqBy = <T, K extends string | number>(
  array: readonly T[],
  predicate: (item: T) => K
) => {
  return Array.from(
    array
      .reduce((acc, item) => {
        acc.set(predicate(item), item)
        return acc
      }, new Map<K, T>())
      .values()
  )
}

export const timesMap = <T>(n: number, fn: (i: number) => T): T[] => {
  const result: T[] = []

  for (let i = 0; i < n; i++) {
    result.push(fn(i))
  }

  return result
}

export const arrayChunk = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = []

  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }

  return chunks
}

export const mapSeries = async <T, R>(
  arr: T[],
  fn: (item: T, index: number, list: T[]) => R | Promise<R>,
): Promise<R[]> => {
  const results: R[] = []

  for (let i = 0, l = arr.length; i < l; i++) {
    results.push(await fn(arr[i], i, arr))
  }

  return results
}

export const reduceAsync = async <T, R>(
  arr: T[],
  fn: (prev: R, item: T, index: number, list: T[]) => R | Promise<R>,
  initial: R,
): Promise<R> => {
  let result = initial

  for (let i = 0, l = arr.length; i < l; i++) {
    result = await fn(result, arr[i], i, arr)
  }

  return result
}

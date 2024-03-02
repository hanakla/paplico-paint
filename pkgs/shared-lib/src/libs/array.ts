// export function findLastFrom<T>(
//   arr: T[],
//   fromIndex: number,
//   predicate: (item: T) => boolean,
// ): T | undefined {
//   const index = findLastIndexFrom(arr, fromIndex, predicate)
//   return index === -1 ? undefined : arr[index]
// }

// export function findLastIndexFrom<T>(
//   arr: T[],
//   fromIndex: number,
//   predicate: (item: T) => boolean,
// ): number {
//   for (let i = fromIndex; i >= 0; i--) {
//     if (predicate(arr[i])) return i
//   }
//   return -1
// }

export function findLoopedFrom<T>(
  arr: T[],
  fromIndex: number,
  predicate: (item: T) => boolean,
): T | undefined {
  const index = findLoopedIndexFrom(arr, fromIndex, predicate)
  return index === -1 ? undefined : arr[index]
}

export function findLoopedIndexFrom(
  arr: any[],
  fromIndex: number,
  predicate: (item: any) => boolean,
): number {
  fromIndex = fromIndex % arr.length

  for (let i = fromIndex; i < arr.length; i++) {
    if (predicate(arr[i])) return i
  }
  for (let i = 0; i < fromIndex; i++) {
    if (predicate(arr[i])) return i
  }

  return -1
}

export function findLoopedLastFrom<T>(
  arr: T[],
  fromIndex: number,
  predicate: (item: T) => boolean,
): T | undefined {
  const index = findLoopedLastIndexFrom(arr, fromIndex, predicate)
  return index === -1 ? undefined : arr[index]
}

export function findLoopedLastIndexFrom(
  arr: any[],
  fromIndex: number,
  predicate: (item: any) => boolean,
): number {
  for (let i = fromIndex; i >= 0; i--) {
    if (predicate(arr[i])) return i
  }
  for (let i = arr.length - 1; i > fromIndex; i--) {
    if (predicate(arr[i])) return i
  }
  return -1
}

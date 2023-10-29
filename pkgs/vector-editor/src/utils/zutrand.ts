export function storePicker<T extends object, K extends keyof T>(...keys: K[]) {
  return (store: T) => {
    const result: Pick<T, K> = {} as any
    for (const key of keys) {
      result[key] = store[key]
    }
    return result
  }
}

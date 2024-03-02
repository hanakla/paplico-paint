type PromiseWithResolvers<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: any) => void
}

export function promiseWithResolvers<T>(): PromiseWithResolvers<T> {
  const out = {} as any

  out.promise = new Promise((resolve, reject) => {
    out.resolve = resolve
    out.reject = reject
  })

  return out
}

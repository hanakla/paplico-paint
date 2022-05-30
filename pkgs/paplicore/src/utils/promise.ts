export type DeferredPromise<T> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

export const deferred = <T>(): DeferredPromise<T> => {
  const d: DeferredPromise<T> = {} as any

  d.promise = new Promise<T>((resolve, reject) => {
    d.resolve = resolve
    d.reject = reject
  })

  return d
}

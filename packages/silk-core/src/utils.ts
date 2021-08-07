class Rejected<T> extends Promise<T> {
  public error?: Error

  then(_: any, rj: any) {
    rj?.(this.error)
    return this as any
  }

  catch(rj: any) {
    rj?.(this.error)
    return this
  }
}

export const fakeRejectedPromise = (error: Error) => {
  const p = new Rejected(() => {})
  p.error = error
  return p
}

export const assign = <T>(obj: T, patch: Partial<T>) =>
  Object.assign(obj, patch)

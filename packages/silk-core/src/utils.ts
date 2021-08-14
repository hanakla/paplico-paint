import clone from 'clone'
import deferred, { DeferredPromise } from 'p-defer'

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

export class AtomicResource<T> {
  private que: DeferredPromise<T>[] = []
  private locked: boolean = false

  constructor(private resource: T) {}

  public enjure(): Promise<T> {
    if (this.locked) {
      const defer = deferred<T>()
      this.que.push(defer)
      return defer.promise
    }

    this.locked = true
    return Promise.resolve(this.resource)
  }

  public get isLocked() {
    return this.locked
  }

  public release(resource: T) {
    if (resource !== this.resource)
      throw new Error('Incorrect resource released')
    if (!this.locked) throw new Error('Unused resource released')

    const next = this.que.splice(0, 1)[0]
    if (next) {
      next.resolve(this.resource)
    } else {
      this.locked = false
    }
  }
}

export const fakeRejectedPromise = (error: Error) => {
  const p = new Rejected(() => {})
  p.error = error
  return p
}

export const assign = <T>(obj: T, patch: Partial<T>) =>
  Object.assign(obj, patch) as T

// prettier-ignore
type RemoveReadonly<T> =
  T extends object? { -readonly [K in keyof T]: T[K] }
  : T extends ReadonlyArray<infer R> ? Array<R>
  : T

export const deepClone = <T>(obj: T): RemoveReadonly<T> =>
  clone(obj, false) as any

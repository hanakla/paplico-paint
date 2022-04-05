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
  private currentOwner: { stack: string; owner: any } | null = null

  constructor(private resource: T) {}

  public enjure({ owner }: { owner?: any } = {}): Promise<T> {
    if (this.locked) {
      const defer = deferred<T>()
      defer.promise.then(() => (this.currentOwner = owner))

      this.que.push(defer)

      console.warn(
        'AtomicResource: Enjure enqueued in locked resource, it may cause deadlock.',
        { resource: this.resource },
        { request: owner, current: this.currentOwner }
      )
      return defer.promise
    }

    this.locked = true
    // console.groupCollapsed('enjure', this.resource)
    // console.trace()
    // console.groupEnd()
    this.currentOwner = { owner, stack: new Error().stack! }
    return Promise.resolve(this.resource)
  }

  public get isLocked() {
    return this.locked
  }

  public release(resource: T) {
    if (resource !== this.resource)
      throw new Error('Incorrect resource released')
    if (!this.locked) throw new Error('Unused resource released')

    // console.groupCollapsed('release', this.resource)
    // console.trace()
    // console.groupEnd()
    const next = this.que.splice(0, 1)[0]
    if (next) {
      next.resolve(this.resource)
    } else {
      this.locked = false
    }
  }
}

export const fakeRejectedPromise = <T>(error: Error) => {
  const p = new Rejected<T>(() => {})
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

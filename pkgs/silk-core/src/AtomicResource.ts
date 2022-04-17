import deferred, { DeferredPromise } from 'p-defer'

export class AtomicResource<T> {
  private que: DeferredPromise<T>[] = []
  private locked: boolean = false
  private currentOwner: { stack: Error; owner: any } | null = null

  constructor(private resource: T) {}

  public enjure({ owner }: { owner?: any } = {}): Promise<T> {
    if (this.locked) {
      const defer = deferred<T>()
      defer.promise.then(() => (this.currentOwner = owner))

      this.que.push(defer)

      console.warn(
        'AtomicResource: Enjure enqueued in locked resource, it may cause deadlock.',
        { resource: this.resource },
        { request: { owner, stack: new Error() }, current: this.currentOwner }
      )

      return defer.promise
    }

    this.locked = true
    // console.groupCollapsed('enjure', this.resource)
    // console.trace()
    // console.groupEnd()
    this.currentOwner = { owner, stack: new Error() }

    // setTimeout(() => {
    //   this.isLocked && this.release(this.resource)
    // }, 3000)

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

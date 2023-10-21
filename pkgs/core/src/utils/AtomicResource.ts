import { deferred, DeferredPromise } from './promise'

export class AtomicResource<T> {
  private que: DeferredPromise<T>[] = []
  private locked: boolean = false
  private currentOwner: {
    stack: Error
    owner: any
    abort?: AbortController
  } | null = null
  private timeoutId: number = -1

  constructor(
    private resource: T,
    private name?: string
  ) {}

  public ensure({ owner }: { owner?: any } = {}): Promise<T> {
    const requestStack = new Error()

    const defer = deferred<T>()
    defer.promise.then(() => {
      this.currentOwner = { owner, stack: requestStack }
    })

    this.que.push(defer)
    queueMicrotask(() => this.eatQueue())

    return defer.promise
  }

  public enjureForce({ owner }: { owner?: any } = {}): T {
    const requestStack = new Error()

    this.locked = true
    this.currentOwner = { owner, stack: requestStack }

    return this.resource
  }

  public get isLocked() {
    return this.locked
  }

  public release(resource: T) {
    if (resource !== this.resource) {
      throw new Error(`Incorrect resource released: ${this.name}`, {
        cause: this.currentOwner,
      })
    }

    if (!this.locked) {
      throw new Error(`Unused resource released: ${this.name}`, {
        cause: this.currentOwner,
      })
    }

    this.locked = false
    this.eatQueue()
  }

  private eatQueue() {
    if (this.locked) {
      clearTimeout(this.timeoutId)
      this.timeoutId = setTimeout(() => this.eatQueue()) as any
      return
    }

    const next = this.que.shift()

    if (next) {
      this.locked = true
      next.resolve(this.resource)
    } else {
      this.locked = false
    }
  }
}

import { deferred, DeferredPromise } from './promise'

export class AtomicResource<T> {
  private que: DeferredPromise<T>[] = []
  private locked: boolean = false
  private currentOwner: { stack: Error; owner: any } | null = null

  constructor(private resource: T, private name?: string) {}

  public enjure({ owner }: { owner?: any } = {}): Promise<T> {
    const requestStack = new Error()

    if (this.locked) {
      const defer = deferred<T>()
      defer.promise.then(
        () => (this.currentOwner = { owner, stack: requestStack })
      )

      this.que.push(defer)

      return defer.promise
    }

    this.locked = true
    this.currentOwner = { owner, stack: requestStack }

    // setTimeout(() => {
    //   this.isLocked && this.release(this.resource)
    // }, 3000)

    return Promise.resolve(this.resource)
  }

  public enjureForce({ owner }: { owner?: any } = {}): T {
    const requestStack = new Error()

    this.locked = true
    this.currentOwner = { owner, stack: requestStack }

    return this.resource
  }

  // public wait({ timeout }: { timeout?: number } = {}): Promise<void> {
  //   if (!this.locked) return Promise.resolve()

  //   return Promise.race([
  //     new Promise<void>((r) => {
  //       const checkAndResolve = () => {
  //         if (!this.locked) r()
  //         else setImmediate(checkAndResolve)
  //       }

  //       setImmediate(checkAndResolve)
  //     }),
  //     ...(timeout == null
  //       ? []
  //       : [
  //           new Promise<void>((r, reject) => {
  //             setTimeout(
  //               () => reject(new Error('AtomicResource timed out')),
  //               timeout
  //             )
  //           }),
  //         ]),
  //   ])
  // }

  // public ensureLazy({
  //   owner,
  //   timeout,
  // }: {
  //   owner?: any
  //   timeout: number
  // }): Promise<T | null> {
  //   return Promise.race([
  //     this.enjure({ owner }),
  //     new Promise<null>((r) => {
  //       setTimeout(() => r(null), timeout)
  //     }),
  //   ])
  // }

  public get isLocked() {
    return this.locked
  }

  public release(resource: T) {
    if (resource !== this.resource)
      throw new Error('Incorrect resource released')
    if (!this.locked) throw new Error('Unused resource released')

    const [next] = this.que.splice(0, 1)
    if (next) {
      next.resolve(this.resource)
    } else {
      this.locked = false
    }
  }
}

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest

  describe('AtomicResource', () => {
    describe('wait', () => {
      it('should resolve immediately if resource is not locked', async () => {
        const atom = new AtomicResource(1)
        const ensureSpy = vi.fn()

        await atom.enjure().then(ensureSpy)
        expect(ensureSpy).toHaveBeenCalledTimes(1)
        expect(ensureSpy).toHaveBeenCalledWith(1)
      })

      it('Should resolve after resource is released', async () => {
        const atom = new AtomicResource(1)
        const ensureSpy = vi.fn()

        const resource = await atom.enjure()
        const promise = atom.enjure().then(ensureSpy)

        expect(ensureSpy).toHaveBeenCalledTimes(0)
        atom.release(resource)

        await promise
        expect(ensureSpy).toHaveBeenCalledTimes(1)
        expect(ensureSpy).toHaveBeenCalledWith(1)
      })

      it('Should not resolve before resource is release', async () => {
        const atom = new AtomicResource(1)
        const ensureSpy = vi.fn()

        const resource = await atom.enjure()
        atom.enjure().then(ensureSpy)

        setTimeout(() => {
          expect(ensureSpy).toHaveBeenCalledTimes(0)

          atom.release(resource)
          expect(ensureSpy).toBeCalledTimes(1)
          expect(ensureSpy).toHaveBeenCalledWith(1)
        }, 100)
      })
    })
  })
}

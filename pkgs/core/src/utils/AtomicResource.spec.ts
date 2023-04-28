import { AtomicResource } from './AtomicResource'

describe('AtomicResource', () => {
  it('should resolve immediately if resource is not locked', async () => {
    const atom = new AtomicResource(1)
    const ensureSpy = vi.fn()

    await atom.ensure().then(ensureSpy)
    expect(ensureSpy).toHaveBeenCalledTimes(1)
    expect(ensureSpy).toHaveBeenCalledWith(1)
  })

  it('Should resolve after resource is released', async () => {
    const atom = new AtomicResource(1)
    const ensureSpy = vi.fn()

    const resource = await atom.ensure()
    const promise = atom.ensure().then(ensureSpy)

    expect(ensureSpy).toHaveBeenCalledTimes(0)
    atom.release(resource)

    await promise
    expect(ensureSpy).toHaveBeenCalledTimes(1)
    expect(ensureSpy).toHaveBeenCalledWith(1)
  })

  it('Should not resolve before resource is release', async () => {
    const atom = new AtomicResource(1)
    const ensureSpy = vi.fn()

    const resource = await atom.ensure()
    atom.ensure().then(ensureSpy)

    setTimeout(() => {
      expect(ensureSpy).toHaveBeenCalledTimes(0)

      atom.release(resource)
      expect(ensureSpy).toBeCalledTimes(1)
      expect(ensureSpy).toHaveBeenCalledWith(1)
    }, 100)
  })
})

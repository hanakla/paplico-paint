import Context from './context'

type Delta = {
  _t: string
  [name: string]: any
}

class PatchContext extends Context {
  public delta: Delta

  constructor(left: any, delta: Delta) {
    super()
    this.left = left
    this.delta = delta
    this.pipe = 'patch'
  }
}

export default PatchContext

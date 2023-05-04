import Context from './context'

type Delta = {
  _t: string
  [name: string]: any
}

class ReverseContext extends Context {
  public delta: {
    _t: string
    [name: string]: any
  }

  public newName?: string

  constructor(delta: Delta) {
    super()
    this.delta = delta
    this.pipe = 'reverse'
  }
}

export default ReverseContext

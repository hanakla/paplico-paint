import { Delta } from '../types'
import Context from './context'

class ReverseContext extends Context {
  public delta: Delta

  public newName?: string

  constructor(delta: Delta) {
    super()
    this.delta = delta
    this.pipe = 'reverse'
  }
}

export default ReverseContext

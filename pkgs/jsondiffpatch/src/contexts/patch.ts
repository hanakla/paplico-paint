import { Delta } from '../types'
import Context from './context'

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

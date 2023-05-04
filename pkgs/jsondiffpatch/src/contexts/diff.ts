import Context from './context'
import defaultClone from '../clone'

class DiffContext extends Context {
  constructor(left: any, right: any) {
    super()
    this.left = left
    this.right = right
    this.pipe = 'diff'
  }

  setResult(result: any) {
    if (this.options.cloneDiffValues && typeof result === 'object') {
      const clone =
        typeof this.options.cloneDiffValues === 'function'
          ? this.options.cloneDiffValues
          : defaultClone
      if (typeof result[0] === 'object') {
        result[0] = clone(result[0])
      }
      if (typeof result[1] === 'object') {
        result[1] = clone(result[1])
      }
    }

    return super.setResult(result)
  }
}

export default DiffContext

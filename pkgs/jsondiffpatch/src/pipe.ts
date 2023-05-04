import Context from './contexts/context'
import Processor from './processor'
import { Filter, FilterContext } from './types'

class Pipe<TContext extends Context> {
  public name: string
  public debug: boolean = false
  public resultCheck: ((context: Context) => void) | null = null
  public filters: Filter<TContext>[] = []
  public processor: Processor | null = null

  constructor(name: string) {
    this.name = name
    this.filters = []
  }

  process(input: TContext) {
    if (!this.processor) {
      throw new Error('add this pipe to a processor before using it')
    }
    let debug = this.debug
    let length = this.filters.length
    let context = input
    for (let index = 0; index < length; index++) {
      let filter = this.filters[index]
      if (debug) {
        this.log(`filter: ${filter.filterName}`)
      }
      filter(context)
      if (typeof context === 'object' && context.exiting) {
        context.exiting = false
        break
      }
    }
    if (!context.next && this.resultCheck) {
      this.resultCheck(context)
    }
  }

  log(msg) {
    console.log(`[jsondiffpatch] ${this.name} pipe, ${msg}`)
  }

  append(...args: Filter<TContext>[]) {
    this.filters.push(...args)
    return this
  }

  prepend(...args: Filter<TContext>[]) {
    this.filters.unshift(...args)
    return this
  }

  indexOf(filterName: string) {
    if (!filterName) {
      throw new Error('a filter name is required')
    }
    for (let index = 0; index < this.filters.length; index++) {
      let filter = this.filters[index]
      if (filter.filterName === filterName) {
        return index
      }
    }
    throw new Error(`filter not found: ${filterName}`)
  }

  list() {
    return this.filters.map(f => f.filterName)
  }

  after(filterName: string) {
    let index = this.indexOf(filterName)
    let params = Array.prototype.slice.call(arguments, 1)
    if (!params.length) {
      throw new Error('a filter is required')
    }
    params.unshift(index + 1, 0)
    this.filters.splice(...params)
    return this
  }

  before(filterName: string) {
    let index = this.indexOf(filterName)
    let params = Array.prototype.slice.call(arguments, 1)
    if (!params.length) {
      throw new Error('a filter is required')
    }
    params.unshift(index, 0)
    this.filters.splice(...params)
    return this
  }

  replace(filterName: string) {
    let index = this.indexOf(filterName)
    let params = Array.prototype.slice.call(arguments, 1)
    if (!params.length) {
      throw new Error('a filter is required')
    }
    params.unshift(index, 1)
    Array.prototype.splice.apply(this.filters, params)
    return this
  }

  remove(filterName: string) {
    let index = this.indexOf(filterName)
    this.filters.splice(index, 1)
    return this
  }

  clear() {
    this.filters.length = 0
    return this
  }

  shouldHaveResult(should?: any) {
    if (should === false) {
      this.resultCheck = null
      return
    }
    if (this.resultCheck) {
      return
    }
    let pipe = this
    this.resultCheck = (context: Context) => {
      if (!context.hasResult) {
        console.log(context)
        let error = new Error(`${pipe.name} failed`)
        error.noResult = true
        throw error
      }
    }
    return this
  }
}

export default Pipe

import Context from './contexts/context'
import Pipe from './pipe'
import { Config, FilterContext } from './types'

export default class Processor {
  public selfOptions: Config
  public pipes: any

  constructor(options?: Config) {
    this.selfOptions = options || {}
    this.pipes = {}
  }

  options(options?: Config) {
    if (options) {
      this.selfOptions = options
    }
    return this.selfOptions
  }

  pipe<T extends Pipe<any>>(name: T | string, pipeArg?: Pipe<FilterContext>) {
    let pipe = pipeArg
    if (typeof name === 'string') {
      if (typeof pipe === 'undefined') {
        return this.pipes[name]
      } else {
        this.pipes[name] = pipe
      }
    }
    if (name && 'name' in name) {
      pipe = name
      if (pipe.processor === this) {
        return pipe
      }
      this.pipes[pipe.name] = pipe
    }
    pipe.processor = this
    return pipe
  }

  process(pipe: Pipe<FilterContext>): any
  process<T extends Context>(input: T, pipe?: Pipe<FilterContext>): any
  process(input: Pipe<FilterContext> | Context, pipe?: Pipe<FilterContext>) {
    let context = input
    context.options = this.options()
    let nextPipe = pipe || input.pipe || 'default'
    let lastPipe
    let lastContext
    while (nextPipe) {
      if (typeof context.nextAfterChildren !== 'undefined') {
        // children processed and coming back to parent
        context.next = context.nextAfterChildren
        context.nextAfterChildren = null
      }

      if (typeof nextPipe === 'string') {
        nextPipe = this.pipe(nextPipe)
      }
      nextPipe.process(context)
      lastContext = context
      lastPipe = nextPipe
      nextPipe = null
      if (context) {
        if (context.next) {
          context = context.next
          nextPipe = lastContext.nextPipe || context.pipe || lastPipe
        }
      }
    }
    return context.hasResult ? context.result : undefined
  }
}

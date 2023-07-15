import Context from './contexts/context'
import DiffContext from './contexts/diff'
import PatchContext from './contexts/patch'
import ReverseContext from './contexts/reverse'
import Pipe, { PipeName } from './pipe'
import { Config, FilterContext } from './types'

export default class Processor {
  public selfOptions: Config
  public pipes: {
    patch?: Pipe<PatchContext>
    diff?: Pipe<DiffContext>
    reverse?: Pipe<ReverseContext>
  }

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

  pipe<TPipe extends Pipe<FilterContext>>(
    name: TPipe | PipeName | undefined | null,
    pipeArg?: Pipe<FilterContext>
  ) {
    let pipe = pipeArg
    if (typeof name === 'string') {
      if (typeof pipe === 'undefined') {
        return this.pipes[name]
      } else {
        this.pipes[name] = pipe
      }
    }
    if (name && name.name) {
      pipe = name
      if (pipe.processor === this) {
        return pipe
      }
      this.pipes[pipe.name] = pipe
    }
    pipe.processor = this
    return pipe
  }

  process<T extends Context>(input: T, pipe?: Pipe): any
  process(input: Context, pipe?: Pipe) {
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

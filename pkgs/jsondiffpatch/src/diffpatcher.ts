import Processor from './processor'
import Pipe from './pipe'
import DiffContext from './contexts/diff'
import PatchContext from './contexts/patch'
import ReverseContext from './contexts/reverse'
import clone from './clone'

import * as trivial from './filters/trivial'
import * as nested from './filters/nested'
import * as arrays from './filters/arrays'
import * as dates from './filters/dates'
import * as texts from './filters/texts'
import type { Config, Delta } from './types'

export default class DiffPatcher {
  public processor: Processor

  constructor(options?: Config) {
    this.processor = new Processor(options)
    this.processor.pipe(
      new Pipe('diff')
        .append(
          nested.collectChildrenDiffFilter,
          trivial.diffFilter,
          dates.diffFilter,
          texts.diffFilter,
          nested.objectsDiffFilter,
          arrays.diffFilter
        )
        .shouldHaveResult()
    )
    this.processor.pipe(
      new Pipe('patch')
        .append(
          nested.collectChildrenPatchFilter,
          arrays.collectChildrenPatchFilter,
          trivial.patchFilter,
          texts.patchFilter,
          nested.patchFilter,
          arrays.patchFilter
        )
        .shouldHaveResult()
    )
    this.processor.pipe(
      new Pipe('reverse')
        .append(
          nested.collectChildrenReverseFilter,
          arrays.collectChildrenReverseFilter,
          trivial.reverseFilter,
          texts.reverseFilter,
          nested.reverseFilter,
          arrays.reverseFilter
        )
        .shouldHaveResult()
    )
  }

  options(...args) {
    return this.processor.options(...args)
  }

  diff(left: any, right: any) {
    return this.processor.process(new DiffContext(left, right))
  }

  patch(left: any, delta: Delta) {
    return this.processor.process(new PatchContext(left, delta))
  }

  reverse(delta: Delta) {
    return this.processor.process(new ReverseContext(delta))
  }

  unpatch(right: any, delta: Delta) {
    return this.patch(right, this.reverse(delta))
  }

  clone(value: any) {
    return clone(value)
  }
}

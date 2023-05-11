import Context from './contexts/context'
import DiffContext from './contexts/diff'
import PatchContext from './contexts/patch'
import ReverseContext from './contexts/reverse'

export type FilterContext = PatchContext | DiffContext | ReverseContext

/**
 * A plugin which can modify the diff(), patch() or reverse() operations
 */
export interface Filter<TContext extends Context> {
  /**
   * A function which is called at each stage of the operation and can update the context to modify the result
   * @param context The current state of the operation
   */
  (context: TContext): void

  /**
   * A unique name which can be used to insert other filters before/after, or remove/replace this filter
   */
  filterName: string
}

export interface Formatter {
  format(delta: Delta, original?: any): string
}

export interface Delta {
  [key: string]: any
  [key: number]: any
}

export interface Config {
  // used to match objects when diffing arrays, by default only === operator is used
  objectHash?: (item: any, index?: number) => string

  matchByPosition?: boolean

  arrays?: {
    // default true, detect items moved inside the array (otherwise they will be registered as remove+add)
    detectMove: boolean
    // default false, the value of items moved is not included in deltas
    includeValueOnMove: boolean
  }

  textDiff?: {
    // default 60, minimum string length (left and right sides) to use text diff algorythm: google-diff-match-patch
    minLength: number
  }

  /**
   * this optional function can be specified to ignore object properties (eg. volatile data)
   * @param name property name, present in either context.left or context.right objects
   * @param context the diff context (has context.left and context.right objects)
   */
  /**
   *
   */
  propertyFilter?: (name: string, context: DiffContext) => boolean

  /**
   *  default false. if true, values in the obtained delta will be cloned (using jsondiffpatch.clone by default),
   *  to ensure delta keeps no references to left or right objects. this becomes useful if you're diffing and patching
   *  the same objects multiple times without serializing deltas.
   *
   *  instead of true, a function can be specified here to provide a custom clone(value)
   */
  cloneDiffValues?: boolean | ((value: any) => any)
}

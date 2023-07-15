import DiffPatcher from './diffpatcher'
import type { Config, Delta } from './types'

// export * as formatters from './formatters/index';
// export * as console from './formatters/console';

export function create(options: Config) {
  return new DiffPatcher(options)
}

export { type Delta, DiffPatcher }
export { default as dateReviver } from './date-reviver'

let defaultInstance: DiffPatcher

export function diff(left: any, right: any) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher()
  }
  return defaultInstance.diff(left, right)
}

export function patch(left: any, delta: Delta) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher()
  }
  return defaultInstance.patch(left, delta)
}

export function unpatch(right: any, delta: Delta) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher()
  }
  return defaultInstance.unpatch(right, delta)
}

export function reverse(delta: Delta) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher()
  }
  return defaultInstance.reverse(delta)
}

export function clone<T>(value: T) {
  if (!defaultInstance) {
    defaultInstance = new DiffPatcher()
  }
  return defaultInstance.clone(value)
}

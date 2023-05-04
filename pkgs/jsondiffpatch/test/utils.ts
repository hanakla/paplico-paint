export const isArray = Array.isArray

export const valueDescription = (value: any) => {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'boolean') {
    return value.toString()
  }
  if (value instanceof Date) {
    return 'Date'
  }
  if (value instanceof RegExp) {
    return 'RegExp'
  }
  if (isArray(value)) {
    return 'array'
  }
  if (typeof value === 'string') {
    if (value.length >= 60) {
      return 'large text'
    }
  }
  return typeof value
}

// Object.keys polyfill
export const objectKeys = obj => Object.keys(obj)

// Array.prototype.forEach polyfill
export const arrayForEach = <T>(
  array: T[],
  fn: (value: T, index: number, list: T[]) => void
) => array.forEach(fn)

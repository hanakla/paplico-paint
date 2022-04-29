export const assign = <T>(obj: T, patch: Partial<T>) =>
  Object.assign(obj, patch)

const hasOwnKey = Object.prototype.hasOwnProperty
const is = (a: any, b: any) => a === b

export const shallowEquals = (prev: any, next: any) => {
  if (is(prev, next)) return true
  if (typeof prev !== typeof next) return false

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) return false

    for (const idx in prev) {
      if (!is(prev[idx], next[idx])) return false
    }

    return true
  }

  if (
    typeof prev === 'object' &&
    typeof next === 'object' &&
    prev !== null &&
    next !== null
  ) {
    for (const key in prev) {
      if (!hasOwnKey.call(next, key)) continue
      if (!is(prev[key], next[key])) return false
    }

    return true
  }

  return false
}

export const pick = <T, K extends readonly (keyof T)[]>(
  obj: T,
  keys: K
): { [KK in ArrayElement<K>]: T[KK] } => {
  return keys.reduce((a, k) => assign(a, { [k]: obj[k] }), Object.create(null))
}

export const exclude = <T, K extends readonly (keyof T)[]>(
  obj: T,
  keys: K
): Omit<T, ArrayElement<K>> => {
  return (Object.keys(obj) as (keyof T)[])
    .filter((k) => !keys.includes(k))
    .reduce((a, k) => assign(a, { [k]: obj[k] }), Object.create(null))
}

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never

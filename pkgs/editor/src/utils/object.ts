export const shallowEquals = (prev: any, next: any) => {
  if (Object.is(prev, next)) return true
  if (typeof prev !== typeof next) return false

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) return false

    for (const idx in prev) {
      if (!Object.is(prev[idx], next[idx])) return false
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
      if (!Object.hasOwn(next, key)) continue
      if (!Object.is(prev[key], next[key])) return false
    }

    return true
  }

  return false
}

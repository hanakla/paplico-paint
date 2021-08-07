export const rafDebounce = <T extends any>(cb: (...args: T[]) => void) => {
  if (typeof requestAnimationFrame !== 'function') return cb

  let id: number = -1
  return (...args: T[]) => {
    cancelAnimationFrame(id)

    id = requestAnimationFrame(() => {
      cb(...args)
    })
  }
}

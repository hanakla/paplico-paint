export const rafDebounce = <T extends any>(
  cb: (...args: T[]) => void,
  time: number = 100
) => {
  if (typeof requestAnimationFrame !== 'function') return cb

  let id: number = -1
  return (...args: T[]) => {
    clearTimeout(id)

    id = window.setTimeout(() => {
      cb(...args)
    }, time)
  }
}

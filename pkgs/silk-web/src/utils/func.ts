export const debounce = <T extends (...args: any[]) => void>(
  fn: T,
  waiting: number
) => {
  let last = -1
  let timerId: number = -1

  const run = (...args: any[]) => {
    last = Date.now()
    clearTimeout(timerId)
    fn(...args)
  }

  return (...args: Parameters<T>) => {
    const now = Date.now()

    if (now - last < waiting) {
      clearTimeout(timerId)
      timerId = window.setTimeout(run, now - last, ...args)
    } else {
      run(...args)
    }
  }
}

import { assign } from './utils/object'

class Rejected<T> extends Promise<T> {
  public error?: Error

  then(_: any, rj: any) {
    rj?.(this.error)
    return this as any
  }

  catch(rj: any) {
    rj?.(this.error)
    return this
  }
}

export const fakeRejectedPromise = <T>(error: Error) => {
  const p = new Rejected<T>(() => {})
  p.error = error
  return p
}

export const setCanvasSize: {
  (
    canvas: HTMLCanvasElement | OffscreenCanvas,
    widthOrSize: number | { width: number; height: number },
    height?: number
  ): void
} = (canvas, widthOrSize, height) => {
  if (typeof widthOrSize === 'object') {
    const { width, height } = widthOrSize
    assign(canvas, { width, height })
  } else {
    assign(canvas, { width: widthOrSize, height })
  }
}

export type Nullish = null | undefined

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

export const createKeyedRequestIdeCallback = () => {
  const map: Record<string, number> = Object.create(null)

  const { idle, cancel } =
    typeof window !== 'undefined'
      ? {
          idle: window.requestIdleCallback || window.setTimeout,
          cancel: window.cancelIdleCallback || window.clearTimeout,
        }
      : {
          idle: setTimeout as (fn: () => void) => any,
          cancel: clearTimeout as (timeout: any) => any,
        }

  return (key: string, fn: () => void) => {
    if (map[key]) cancel(map[key])
    map[key] = idle(fn)
  }
}

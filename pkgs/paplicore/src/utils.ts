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

export const setCanvasSizeIfDifferent = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  widthOrSize: number | { width: number; height: number },
  height?: number
) => {
  if (typeof widthOrSize === 'object') {
    const { width, height } = widthOrSize
    if (canvas.width === width && canvas.height === height) return
    assign(canvas, { width, height })
  } else {
    if (canvas.width === widthOrSize && canvas.height === height) return
    assign(canvas, { width: widthOrSize, height })
  }
}

export type Nullish = null | undefined

export const debounce = <T extends (...args: any[]) => void>(
  fn: T,
  waiting: number
) => {
  let last = 0
  let timerId: number = -1

  const run = (...args: any[]) => {
    clearTimeout(timerId)

    fn(...args)
    last = Date.now()
  }

  return (...args: Parameters<T>) => {
    window.clearTimeout(timerId)

    const now = Date.now()
    if (now - last < waiting) {
      timerId = window.setTimeout(run, now - last, ...args)
    } else {
      run(...args)
    }
  }
}

export const throttleSingle = <T extends (...args: any[]) => Promise<any>>(
  fn: T
) => {
  let running = false
  let queue: (() => void) | null = null

  return async (...args: Parameters<T>) => {
    if (running) {
      queue = () => fn(...args)
      return
    }

    running = true
    await fn(...args)
    running = false

    let q = queue
    queue = null

    q?.()
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

import clone from 'clone'

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

export const assign = <T>(obj: T, patch: Partial<T>) =>
  Object.assign(obj, patch) as T

interface Merger {
  <T1, T2>(obj1: T1, obj2: T2): T1 & T2
  <T1, T2, T3>(obj1: T1, obj2: T2, obj3: T3): T1 & T2 & T3
  <T1, T2, T3, T4>(obj1: T1, obj2: T2, obj3: T3, obj4: T4): T1 & T2 & T3 & T4
}
export const mergeToNew: Merger = (...obj: any[]) => {
  return Object.assign({}, ...obj)
}

export const pick = <T, K extends readonly (keyof T)[]>(
  obj: T,
  keys: K
): { [KK in ArrayElement<K>]: T[KK] } => {
  return keys.reduce((a, k) => assign(a, { [k]: obj[k] }), Object.create(null))
}

type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never

// prettier-ignore
type RemoveReadonly<T> =
  T extends object? { -readonly [K in keyof T]: T[K] }
  : T extends ReadonlyArray<infer R> ? Array<R>
  : T

export const deepClone = <T>(obj: T): RemoveReadonly<T> =>
  clone(obj, false) as any

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

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

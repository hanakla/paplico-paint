import {
  DependencyList,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { shallowEquals } from './object'

export const usePropsMemo = () => {
  const store = useMemo(
    () => new Map<string, { prev: DependencyList; value: any }>(),
    [],
  )

  return useMemo(
    () => ({
      memo: <T>(key: string, value: () => T, deps: DependencyList): T => {
        const prev = store.get(key)
        let returnValue = prev?.value

        if (prev == null || !shallowEquals(prev.prev, deps)) {
          returnValue = typeof value === 'function' ? value() : value
          store.set(key, { prev: deps, value: returnValue })
        }

        return returnValue
      },
    }),
    [],
  )
}

/**
 * Stable referenced useCallback
 *
 * ```ts
 * // useCallback
 * const handleClick = useEventCallback(() => {
 *   console.log(dep)
 * , [dep]) <-- needs to deps
 *
 * // useEventCallback
 * const handleClick = useEventCallback(() => {
 *   console.log(dep)
 * }) // no deps needed
 */
export function useEventCallback<T extends (...args: any[]) => any>(fn: T) {
  const latestRef = useRef<T | null>(null)
  const stableRef = useRef<T | null>(null)

  if (stableRef.current == null) {
    stableRef.current = function (this: any) {
      return latestRef.current!.apply(this, arguments as any)
    } as T
  }

  useLayoutEffect(() => {
    latestRef.current = fn
  }, [fn])

  return stableRef.current
}

/**
 * useEffect for DOMEventListeners it's provide AbortSignal at 1st argument,
 * it's aborting on unmount to remove event listeners.
 */
export function useEffectWithSignal(
  effect: (signal: AbortSignal) => (() => void) | void,
  deps: DependencyList,
) {
  useEffect(() => {
    const abort = new AbortController()
    const cleanup = effect(abort.signal)

    return () => {
      abort.abort()
      cleanup?.()
    }
  }, deps)
}

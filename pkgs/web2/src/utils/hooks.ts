import {
  DependencyList,
  MutableRefObject,
  ForwardedRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useIsomorphicLayoutEffect } from 'react-use'
import { shallowEquals } from './object'

const useBrowserEffect =
  typeof window !== 'undefined' ? useLayoutEffect : () => {}

export const useStableLatestRef = <T>(value: T) => {
  const stableRef = useRef<T>(value)

  useBrowserEffect(() => {
    stableRef.current = value
  }, [value])

  return stableRef
}

export const useMedia = (query: string, defaultState?: boolean) => {
  if (defaultState === undefined) {
    defaultState = false
  }

  const [state, setState] = useState(defaultState)

  useIsomorphicLayoutEffect(() => {
    const mql = window.matchMedia(query)
    setState(mql.matches)

    const onChange = () => setState(!!mql.matches)
    mql.addEventListener('change', onChange)

    return () => {
      mql.removeEventListener('change', onChange)
    }
  }, [query])
  return state
}

export const useIsMobileDevice = () => {
  return useMedia('(max-width: 768px)')
}

export const useChangedEffect = (
  effect: () => void | (() => void | undefined),
  watch: DependencyList,
) => {
  const callbackRef = useStableLatestRef(effect)
  const prevWatch = useRef<DependencyList | null>(null)

  useEffect(() => {
    if (prevWatch.current == null) {
      prevWatch.current = watch
      return
    }

    for (const idx in watch) {
      if (prevWatch.current[idx] !== watch[idx]) {
        prevWatch.current = watch
        return callbackRef.current()
      }
    }
  }, watch)
}

export const useCombineRef = <T>(
  ...refs: Array<
    MutableRefObject<T> | ForwardedRef<T> | ((el: T | null) => void)
  >
): MutableRefObject<T> => {
  const ref = useRef<T>()

  return useMemo(
    () => ({
      get current() {
        return ref.current
      },
      set current(el: any) {
        ref.current = el
        refs.forEach((ref) => {
          if (ref == null) return
          if (typeof ref === 'function') ref(el)
          else ref.current = el
        })
      },
    }),
    [...refs],
  )
}

/** useState, but update state on original value changed */
export const useBufferedState = <T, S = T>(
  original: T | (() => T),
  transform?: (value: T) => S,
): [S, (value: S | ((prevState: S) => S)) => S] => {
  const originalValue =
    typeof original === 'function' ? (original as any)() : original
  const [state, setState] = useState<S | T>(
    () => transform?.(originalValue) ?? originalValue,
  )
  const prevOriginal = useRef(originalValue)

  useIsomorphicLayoutEffect(() => {
    if (
      prevOriginal.current === originalValue ||
      shallowEquals(prevOriginal.current, originalValue)
    )
      return

    prevOriginal.current = originalValue
    setState(transform?.(originalValue) ?? originalValue)
  }, [originalValue])

  return [state as T, setState] as any
}

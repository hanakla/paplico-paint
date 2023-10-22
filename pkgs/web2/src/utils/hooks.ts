import {
  DependencyList,
  RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'

const useBrowserEffect =
  typeof window !== 'undefined' ? useLayoutEffect : () => {}

export const useStableLatestRef = <T>(value: T) => {
  const stableRef = useRef<T>(value)

  useBrowserEffect(() => {
    stableRef.current = value
  }, [value])

  return stableRef
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
  ...refs: Array<React.MutableRefObject<T> | ((el: T | null) => void)>
): RefObject<T> => {
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

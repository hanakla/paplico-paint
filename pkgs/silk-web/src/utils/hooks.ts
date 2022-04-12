import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

export const useMedia = (query: string, defaultState?: boolean) => {
  if (defaultState === undefined) {
    defaultState = false
  }

  const [state, setState] = useState(defaultState)

  useEffect(() => {
    let mounted = true
    const mql = window.matchMedia(query)

    const onChange = function () {
      if (!mounted) return
      setState(!!mql.matches)
    }

    setTimeout(() => {
      setState(mql.matches)
    })

    mql.addEventListener('change', onChange)

    return () => {
      mounted = false
      mql.removeEventListener('change', onChange)
    }
  }, [query])
  return state
}

export const useCachedInputState = <T>(original: T) => {
  const [state, setState] = useState<T>(original)
  const prevOriginal = useRef(original)

  useIsomorphicLayoutEffect(() => {
    if (prevOriginal.current === original) return

    prevOriginal.current = original
    setState(original)
  }, [original])

  return [state, setState] as const
}

export const useDebouncedFunk = <T extends (...args: any[]) => unknown>(
  fn: T,
  timeout: number
) => {
  const fnk = useRef<T>(fn)
  fnk.current = fn

  const timeoutId = useRef<number>(-1)

  return useCallback((...args: Parameters<T>) => {
    window.clearTimeout(timeoutId.current)
    timeoutId.current = window.setTimeout(() => fnk.current(...args), timeout)
  }, [])
}

export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

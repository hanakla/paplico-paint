import { useFleurContext } from '@fleur/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { shallowEquals } from './object'

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

export const useBufferedState = <T, S = T>(
  original: T,
  transform?: (value: T) => S
): [state: S, setState: (current: S) => S] => {
  const [state, setState] = useState<S | T>(
    () => transform?.(original) ?? original
  )
  const prevOriginal = useRef(original)

  useIsomorphicLayoutEffect(() => {
    if (
      prevOriginal.current === original ||
      shallowEquals(prevOriginal.current, original)
    )
      return

    prevOriginal.current = original
    setState(transform?.(original) ?? original)
  }, [original])

  return [state, setState] as any
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

export const useFleur = () => {
  const ctx = useFleurContext()
  return useMemo(
    () => ({
      execute: ctx.executeOperation,
      getStore: ctx.getStore,
    }),
    []
  )
}

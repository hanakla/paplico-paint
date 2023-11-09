import {
  DependencyList,
  MutableRefObject,
  ForwardedRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useReducer,
} from 'react'
import { useIsomorphicLayoutEffect } from 'react-use'
import { changedKeys, shallowEquals } from './object'
import Mousetrap from 'mousetrap'
import { getLine } from './string'

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

type MousetrapCallback = (
  e: Mousetrap.ExtendedKeyboardEvent,
  combo: string,
) => void

export const usetRegionalMouseTrap = (
  ref: MutableRefObject<HTMLElement | null>,
  handlerKey: string[] | null,
  handlerCallback: MousetrapCallback,
  evtType: 'keyup' | 'keydown' | undefined = undefined,
) => {
  const handlerRef = useStableLatestRef(handlerCallback)

  useEffect(() => {
    if (!ref.current) return
    if (!handlerKey) return

    const mt = new Mousetrap(ref.current)
    mt.bind(
      handlerKey,
      (e, combo) => {
        e.preventDefault()
        e.stopPropagation()

        handlerRef.current(e, combo)
      },
      evtType,
    )

    return () => {
      mt.unbind(handlerKey)
    }
  }, [handlerKey, ref.current])
}

export const useGlobalMousetrap = (
  handlerKey: string[] | null | undefined,
  handlerCallback: MousetrapCallback,
  evtType: 'keyup' | 'keydown' | undefined = undefined,
) => {
  const handlerRef = useStableLatestRef(handlerCallback)

  useEffect(() => {
    if (!handlerKey) return

    Mousetrap.bind(
      handlerKey,
      (e, combo) => {
        e.preventDefault()

        handlerRef.current(e, combo)
      },
      evtType,
    )

    return () => {
      Mousetrap.unbind(handlerKey)
    }
  }, [handlerKey])
}

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

export const useDangerouslyEffectAsync = (
  fn: () => void | (() => void) | Promise<() => void>,
  deps: DependencyList,
) => {
  useEffect(() => {
    let unmounted = false
    let cleanup = fn()

    if (cleanup instanceof Promise) {
      cleanup.then((c) => {
        if (unmounted) return c()
        cleanup = c
      })
    }

    return () => {
      unmounted = true
      if (typeof cleanup === 'function') cleanup()
    }
  }, deps)
}

export const useStateSync = (fn: () => void, deps: DependencyList) => {
  return useMemo(fn, deps)
}

export const useChangeDetection = (values: Record<string, any>) => {
  const prev = useRef(values)

  useBrowserEffect(() => {
    const changed = changedKeys(prev.current, values)
    if (changed.length > 0) {
      console.group('changed', changed)
      console.log(getLine(new Error().stack!, 1, Infinity))
      console.groupEnd()
    }
    prev.current = values
  }, [values])
}

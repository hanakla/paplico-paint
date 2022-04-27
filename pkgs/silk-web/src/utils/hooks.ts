import { useFleurContext } from '@fleur/react'
import { autoUpdate, UseFloatingReturn } from '@floating-ui/react-dom'
import {
  Ref,
  RefObject,
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

// export const useBenriRef = <T>(initialValue: T) => {
//   const ref = useRef(initialValue)

//   return useMemo(() => {
//     const handler = (element: T) => {
//       ref.current = element
//     }
//     Object.defineProperty(handler, 'current', {
//       set: (element: T) => {
//         ref.current = element
//       },
//       get: () => ref.current,
//     })
//     return handler as ((element: T) => void) & { current: T }
//   }, [])
// }

/** useState, but update state on original value changed */
export const useBufferedState = <T, S = T>(
  original: T | (() => T),
  transform?: (value: T) => S
) => {
  const originalValue =
    typeof original === 'function' ? (original as any)() : original
  const [state, setState] = useState<S | T>(
    () => transform?.(originalValue) ?? originalValue
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

export const useMultiFingerTouch = (
  callback: (e: TouchEvent & { fingers: number }) => void,
  { threshold = 100 }: { threshold?: number } = {}
): Ref<HTMLElement | SVGElement> => {
  const [ref, setRef] = useState<HTMLElement | SVGElement | null>(null)

  useEffect(() => {
    if (!ref) return

    const idents = new Set<number>()
    let firstTouchTime: number | null = null

    const throttle = <T extends (...args: any[]) => any>(
      fn: T,
      threshold: number
    ) => {
      let lastTime = 0

      return (...args: Parameters<T>): void => {
        if (Date.now() - lastTime < threshold) return

        lastTime = Date.now()
        fn(...args)
      }
    }

    const throttledCallback = throttle(callback, threshold)

    const onTouchStart = (e: TouchEvent) => {
      if (firstTouchTime != null && Date.now() - firstTouchTime > threshold) {
        // expired
        idents.clear()
        firstTouchTime = null
      }

      if (idents.size === 0) {
        firstTouchTime = Date.now()
      }

      Array.from(e.touches).forEach(({ identifier }) => idents.add(identifier))
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (Date.now() - firstTouchTime! <= threshold) {
        if (idents.size >= 2) {
          throttledCallback(Object.assign(e, { fingers: idents.size }))
        }
      } else {
        idents.clear()
        firstTouchTime = null
      }
    }

    ;(ref as HTMLElement).addEventListener('touchstart', onTouchStart, {
      passive: true,
    })
    ;(ref as HTMLElement).addEventListener('touchend', onTouchEnd, {
      passive: true,
    })

    return () => {
      ;(ref as HTMLElement).removeEventListener('touchstart', onTouchStart)
      ;(ref as HTMLElement).removeEventListener('touchend', onTouchEnd)
    }
  }, [ref, callback, threshold])

  return (el: HTMLElement | SVGElement | null) => {
    setRef(el)
  }
}

export const useDelayedLeave = (
  ref: RefObject<HTMLElement>,
  delay: number = 1000,
  callback: () => void
) => {
  const isEnter = useRef(false)
  let timeoutId: number = -1

  useEffect(() => {
    if (!ref.current) return

    const current = ref.current

    const onMouseDown = () => {
      isEnter.current = true
      clearTimeout(timeoutId)
    }

    const onMouseUp = () => {
      if (!isEnter.current) return
      isEnter.current = false
      timeoutId = window.setTimeout(callback, delay)
    }

    current.addEventListener('pointerdown', onMouseDown, { passive: true })
    current.addEventListener('pointerup', onMouseUp, { passive: true })

    return () => {
      clearTimeout(timeoutId)
      current.removeEventListener('mousedown', onMouseDown)
      current.removeEventListener('mouseup', onMouseUp)
    }
  }, [ref.current])
}

export const useAutoUpdateFloating = (fl: UseFloatingReturn) => {
  useEffect(() => {
    if (!fl.refs.reference.current || !fl.refs.floating.current) return

    return autoUpdate(
      fl.refs.reference.current,
      fl.refs.floating.current,
      fl.update
    )
  }, [fl.refs.reference.current, fl.refs.floating.current, fl.update])
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

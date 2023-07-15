import MouseTrap, { ExtendedKeyboardEvent } from 'mousetrap'
import {
  DependencyList,
  RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'

export const useMouseTrap = (
  ref: RefObject<HTMLElement | null>,
  binds: { key: string | string[]; handler: () => void }[],
  deps: DependencyList
) => {
  useEffect(() => {
    if (!ref.current) return

    const mt = new MouseTrap(ref.current)
    binds.forEach((bind) => mt.bind(bind.key, bind.handler))

    return () => {
      mt.reset()
    }
  }, [ref.current, ...deps])

  return ref
}

export const useFunkyMouseTrap = (
  ref: RefObject<Element | null>,
  keys: string[],
  handler: (e: ExtendedKeyboardEvent) => void
) => {
  const handlerRef = useStableLatestRef(handler)

  useEffect(() => {
    if (!ref.current) return

    const mt = new MouseTrap(ref.current)
    mt.bind(keys, (e) => handlerRef.current(e))

    return () => {
      mt.reset()
    }
  }, [ref.current, ...keys])
}

export const useFunkyGlobalMouseTrap = (
  keys: string[],
  handler: (e: ExtendedKeyboardEvent) => void
) => {
  const handlerRef = useStableLatestRef(handler)

  useEffect(() => {
    const mt = new MouseTrap()
    const cb = (e: ExtendedKeyboardEvent) => handlerRef.current(e)

    mt.bind(keys, cb)

    return () => {
      mt.reset()
    }
  }, [...keys])
}

export const useGlobalMouseTrap = (
  binds: {
    key: string | string[]
    handler: (e: ExtendedKeyboardEvent) => void
  }[],
  deps: DependencyList
) => {
  useEffect(() => {
    const mt = new MouseTrap()
    binds.forEach((bind) => mt.bind(bind.key, bind.handler))

    return () => {
      mt.reset()
    }
  }, deps)
}

const useBrowserEffect =
  typeof window !== 'undefined' ? useLayoutEffect : () => {}

export const useStableLatestRef = <T>(value: T) => {
  const stableRef = useRef<T>(value)

  useBrowserEffect(() => {
    stableRef.current = value
  }, [value])

  return stableRef
}

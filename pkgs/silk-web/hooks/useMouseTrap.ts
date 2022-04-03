import MouseTrap, { ExtendedKeyboardEvent } from 'mousetrap'
import { DependencyList, RefObject, useEffect, useRef } from 'react'

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

export const useFunkyGlobalMouseTrap = (
  keys: string[],
  handler: (e: ExtendedKeyboardEvent) => void
) => {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

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

import MouseTrap, { ExtendedKeyboardEvent } from 'mousetrap'
import { DependencyList, RefObject, useEffect } from 'react'
import { log } from '../utils/log'

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

export const useGlobalMouseTrap = (
  binds: { key: string; handler: (e: ExtendedKeyboardEvent) => void }[],
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
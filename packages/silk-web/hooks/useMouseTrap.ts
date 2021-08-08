import MouseTrap from 'mousetrap'
import { RefObject, useEffect } from 'react'

export const useMouseTrap = (
  ref: RefObject<HTMLElement | null>,
  binds: { key: string; handler: () => void }[]
) => {
  useEffect(() => {
    if (!ref.current) return

    const mt = new MouseTrap(ref.current)
    binds.forEach((bind) => mt.bind(bind.key, bind.handler))

    return () => {
      mt.reset()
    }
  }, [binds])

  return ref
}

export const useGlobalMouseTrap = (
  binds: { key: string; handler: () => void }[]
) => {
  useEffect(() => {
    const mt = new MouseTrap()
    binds.forEach((bind) => mt.bind(bind.key, bind.handler))

    return () => {
      mt.reset()
    }
  }, [binds])
}

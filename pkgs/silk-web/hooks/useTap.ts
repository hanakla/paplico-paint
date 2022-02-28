import { TouchEvent, useCallback, useRef } from 'react'

export const useTap = <T extends HTMLElement>(
  callback: (e: TouchEvent<T>) => void,
  options?: { threshold?: number }
) => {
  const { threshold = 100 } = options || {}

  const lastTap = useRef(Date.now())

  const onTouchStart = useCallback(() => {
    lastTap.current = Date.now()
  }, [])

  const onTouchEnd = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      if (Date.now() - lastTap.current > threshold) return
      callback(e)
    },
    [callback, threshold]
  )

  return { onTouchStart, onTouchEnd }
}

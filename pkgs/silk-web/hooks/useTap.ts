import { useFunk } from '@hanakla/arma'
import { TouchEvent, useRef } from 'react'

export const useTap = <T extends HTMLElement>(
  callback: (e: TouchEvent<T>) => void,
  options?: { threshold?: number }
) => {
  const { threshold = 100 } = options || {}

  const lastTap = useRef(Date.now())

  const onTouchStart = useFunk(() => {
    lastTap.current = Date.now()
  })

  const onTouchEnd = useFunk((e: TouchEvent<HTMLElement>) => {
    if (Date.now() - lastTap.current > threshold) return
    callback(e)
  })

  return { onTouchStart, onTouchEnd }
}

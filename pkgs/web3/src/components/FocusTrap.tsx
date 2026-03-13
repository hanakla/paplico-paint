import { ReactNode, useEffect, useRef } from 'react'
import { FocusTrap as _FocusTrap, createFocusTrap } from 'focus-trap'

type Props = {
  as?: string
  className?: string
  paused?: boolean
  children: ReactNode
}

export function FocusTrap({
  // as: As = 'div',
  // className,
  paused,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const focusTrap = useRef<_FocusTrap | null>(null)

  useEffect(() => {
    const trap = (focusTrap.current = createFocusTrap(ref.current!, {
      preventScroll: true,
    }))
    trap.activate()

    paused ? trap.pause() : trap.unpause()
  }, [])

  useEffect(() => {
    if (!focusTrap.current) return

    if (paused) focusTrap.current.pause()
    else focusTrap.current.unpause()
  }, [paused])

  return (
    <div role="none" ref={ref} style={{ display: 'contents' }} tabIndex={-1}>
      {children}
    </div>
  )
}

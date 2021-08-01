import React, { ReactNode, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUpdate} from 'react-use'

export const Portal = ({ children }: { children: ReactNode }) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const rerender = useUpdate()

  useEffect(() => {
    const root = rootRef.current = document.createElement('div')
    document.body.appendChild(root)
    rerender()

    return () => {
      document.body.removeChild(root)
    }
  }, [])

  return <>{rootRef.current ?  createPortal(children, rootRef.current): children}</>
}

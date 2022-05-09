import React, { ReactNode, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUpdate } from 'react-use'

export const Portal = ({
  children,
  mountPointId,
}: {
  children: ReactNode
  mountPointId?: string
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const rerender = useUpdate()

  useEffect(() => {
    const root = (rootRef.current = document.createElement('div'))
    const mountTo = mountPointId
      ? document.getElementById(mountPointId)!
      : document.body

    mountTo?.appendChild(root)
    rerender()

    return () => {
      mountTo.removeChild(root)
    }
  }, [])

  return <>{rootRef.current ? createPortal(children, rootRef.current) : null}</>
}

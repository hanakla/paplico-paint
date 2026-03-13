import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  targetSelector?: string
  children: React.ReactNode
}

export function Portal({
  targetSelector: targetQuerySelector,
  children,
}: Props) {
  const [parent, setParent] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const root = targetQuerySelector
      ? (document.querySelector(targetQuerySelector)! as HTMLElement)
      : document.createElement('div')

    const container = document.querySelector('[data-is-root-theme]')!

    container.appendChild(root)
    setParent(root)

    return () => {
      // container.removeChild(root)
    }
  }, [])

  return parent ? createPortal(children, parent) : null
}

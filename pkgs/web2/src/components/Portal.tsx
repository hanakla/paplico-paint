import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  children: React.ReactNode
}

export function Portal({ children }: Props) {
  const [parent, setParent] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const root = document.createElement('div')
    const container = document.querySelector('[data-is-root-theme]')!

    container.appendChild(root)
    setParent(root)

    return () => {
      container.removeChild(root)
    }
  }, [])

  return parent ? createPortal(children, parent) : null
}

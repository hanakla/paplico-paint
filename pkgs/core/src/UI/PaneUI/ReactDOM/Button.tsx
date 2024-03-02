import { memo, useCallback } from 'react'
import { VNode } from '../AbstractComponent'

export namespace Button {
  export type Props = {
    children?: VNode
    onClick?: () => void
  }
}

export const Button = memo(function Button({
  onClick,
  children,
}: Button.Props) {
  const handleClick = useCallback(() => {
    onClick?.()
  }, [])

  return <button onClick={handleClick}>{children}</button>
})

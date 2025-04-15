import { VNode } from '../AbstractComponent'
import { memo, useCallback } from 'react'

export namespace Button {
  export interface Props {
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

import { PaneUI } from '@paplico/core-new'
import { Button as _Button } from '@radix-ui/themes'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'

export const Button = memo(function Button({
  style,
  children,
  onClick,
}: PaneUI.PaneComponentProps.Button) {
  const handleClick = useEvent(() => {
    onClick?.()
  })

  return (
    <_Button style={style} onClick={handleClick}>
      {children}
    </_Button>
  )
})

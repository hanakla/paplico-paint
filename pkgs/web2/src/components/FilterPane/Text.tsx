import { PaneUI } from '@paplico/core-new'
import { memo } from 'react'

export const Text = memo(function Text({
  style,
  children,
}: PaneUI.PaneComponentProps.Text) {
  return <span style={style}>{children}</span>
})

import { PaneComponentProps } from '../PaneComponentProps'
import { memo } from 'react'

export const Text = memo(function Text({
  style,
  children,
}: PaneComponentProps.Text) {
  return <span style={style}>{children}</span>
})

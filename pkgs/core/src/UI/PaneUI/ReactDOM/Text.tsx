import { memo } from 'react'
import { PaneComponentProps } from '../PaneComponentProps'

export const Text = memo(function Text({
  style,
  children,
}: PaneComponentProps.Text) {
  return <span style={style}>{children}</span>
})

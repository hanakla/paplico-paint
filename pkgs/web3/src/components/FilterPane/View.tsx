import { PaneUI } from '@paplico/core-new'
import { memo } from 'react'

export const View = memo(function View({
  style,
  flexFlow,
  children,
}: PaneUI.PaneComponentProps.View) {
  return <div style={{ ...style, display: 'flex', flexFlow }}>{children}</div>
})

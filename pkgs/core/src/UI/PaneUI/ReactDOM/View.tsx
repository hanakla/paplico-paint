import { memo } from 'react'
import { PaneComponentProps } from '../PaneComponentProps'

export const View = memo(function View({
  flexFlow = 'row',
  children,
}: PaneComponentProps.View) {
  return (
    <div
      style={{
        display: 'flex',
        flexFlow,
      }}
    >
      {children}
    </div>
  )
})

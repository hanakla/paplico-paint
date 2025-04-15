import { PaneComponentProps } from '../PaneComponentProps'
import { memo } from 'react'

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

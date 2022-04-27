import { memo } from 'react'
import { centering } from '🙌/utils/mixins'

export const NotFound = memo(function NotFound() {
  return (
    <div
      css={`
        ${centering}
      `}
    >
      <h1>そんなものはない</h1>
    </div>
  )
})

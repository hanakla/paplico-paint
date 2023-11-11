import { memo, useEffect } from 'react'
import { FallbackProps } from 'react-error-boundary'

export const ErrorFallback = memo(
  ({ error, resetErrorBoundary }: FallbackProps) => {
    useEffect(() => {
      const id = setTimeout(() => {
        resetErrorBoundary()
      }, 1000)

      return () => clearTimeout(id)
    }, [error])

    return (
      <svg width={100} height={100} viewBox="0 0 100 100">
        <text>Error: {error.message}</text>
      </svg>
    )
  },
)

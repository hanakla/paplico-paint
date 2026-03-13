import { ReactNode, forwardRef, memo } from 'react'
import { css } from 'styled-components'
import {
  FloatablePaneIds,
  useFloatablePaneStore,
} from '../domains/floatablePanes'
import { Box } from '@radix-ui/themes'

type Props = {
  paneId: FloatablePaneIds
  title: ReactNode
  className?: string
  children?: ReactNode
}

export const FloatablePane = memo(
  forwardRef<HTMLDivElement, Props>(function FloatablePane(
    { paneId, title, className, children },
    ref,
  ) {
    // const store = useFloatablePaneStore()

    const isFloating = false

    return (
      <div
        ref={ref}
        css={css`
          display: flex;
          flex-flow: column;
          padding: 8px 12px;
          border-radius: 8px;
          overflow: hidden;
        `}
        className={className}
        style={{
          boxShadow: isFloating ? '0 0 8px rgba(0, 0, 0, 0.15)' : 'none',
        }}
      >
        <h1
          css={css`
            display: flex;
            align-items: center;
            margin-bottom: 4px;
            font-weight: bold;
            font-size: var(--font-size-1);
            line-height: var(--line-height-1);
            color: var(--gray-9);
          `}
        >
          {title}
        </h1>

        {children}
      </div>
    )
  }),
)

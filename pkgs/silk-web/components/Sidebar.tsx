import { forwardRef, ReactNode, CSSProperties } from 'react'
import { css } from 'styled-components'

type Props = {
  className?: string
  children?: ReactNode
  style?: CSSProperties
  closed?: boolean
}

export const Sidebar = forwardRef<HTMLDivElement, Props>(
  ({ className, style, closed, children }, ref) => {
    return (
      <div
        ref={ref}
        css={css`
          position: relative;
          display: flex;
          flex-flow: column;
          height: 100%;
          max-width: 200px;
          overflow: hidden;
          background-color: ${({ theme }) => theme.color.surface3};
        `}
        className={className}
      >
        <div
          css={css`
            display: flex;
            flex-flow: column;
            flex: 1;
            height: 100%;
            padding-bottom: env(safe-area-inset-bottom);
            transition: 0.2s ease-in-out;
            transition-property: width opacity;

            opacity: 1;
          `}
          style={{
            ...style,
            ...(closed ? { opacity: 0, pointerEvents: 'none' } : {}),
          }}
        >
          {children}
        </div>
      </div>
    )
  }
)

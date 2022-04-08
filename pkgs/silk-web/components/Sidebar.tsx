import { forwardRef, ReactNode, CSSProperties } from 'react'
import { css } from 'styled-components'

type Props = {
  className?: string
  children?: ReactNode
  style?: CSSProperties
}

export const Sidebar = forwardRef<HTMLDivElement, Props>(
  ({ className, style, children }, ref) => {
    return (
      <div
        ref={ref}
        css={css`
          position: relative;
          display: flex;
          flex-flow: column;
          height: 100%;
          max-width: 200px;
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
            transition: width 0.2s ease-in-out;
            background-color: ${({ theme }) => theme.color.surface3};
          `}
          style={style}
        >
          {children}
        </div>
      </div>
    )
  }
)

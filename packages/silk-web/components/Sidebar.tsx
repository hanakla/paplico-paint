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
          max-width: 200px;
        `}
        className={className}
      >
        <div
          ref={ref}
          css={css`
            display: flex;
            flex-flow: column;
            /* width: 200px; */
            height: 100%;
            padding-bottom: env(safe-area-inset-bottom);
            transition: width 0.2s ease-in-out;
            background-color: ${({ theme }) => theme.surface.sidebarBlack};
          `}
          style={style}
        >
          {children}
        </div>
      </div>
    )
  }
)

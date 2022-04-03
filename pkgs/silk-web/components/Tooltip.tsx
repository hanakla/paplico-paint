import { rgba } from 'polished'
import { forwardRef, ReactNode } from 'react'
import { CSSProperties } from 'styled-components'

type Props = {
  style: CSSProperties
  className?: string
  children?: ReactNode
}

export const Tooltip = forwardRef<HTMLDivElement, Props>(
  ({ children, className, style }, ref) => {
    return (
      <div
        ref={ref}
        css={`
          padding: 8px;
          background-color: ${rgba(0, 0, 0, 0.8)};
          border-radius: 8px;
          text-align: center;
          color: #fff;
        `}
        style={style}
      >
        {children}
      </div>
    )
  }
)

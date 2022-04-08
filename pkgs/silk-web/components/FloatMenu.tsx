import { MutableRefObject } from 'react'
import { CSSProperties, forwardRef, ReactNode } from 'react'
import { css } from 'styled-components'

type Props = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export const FloatMenu = forwardRef<HTMLDivElement, Props>(
  ({ children, className, style }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        css={css`
          margin-bottom: 16px;
          background-color: ${({ theme }) => theme.surface.floatWhite};
          border-radius: 4px;
        `}
        style={style}
        // style={{
        //   ...brushPopper.styles.popper,
        //   ...(openBrush ? { opacity: 1, pointerEvents: 'all' } :  { opacity: 0, pointerEvents: 'none' })
        // }}
      >
        {children}
      </div>
    )
  }
)

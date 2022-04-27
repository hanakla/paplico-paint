import { CSSProperties, forwardRef, ReactNode } from 'react'
import styled, { css } from 'styled-components'

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
          position: relative;
          margin-bottom: 16px;
          background-color: ${({ theme }) => theme.surface.floatWhite};
          border-radius: 4px;
        `}
        style={style}
      >
        {children}
      </div>
    )
  }
)

export const FloatMenuArrow = styled.div`
  display: inline-block;
  position: absolute;
  top: 100%;
  border: 6px solid;
  border-color: ${({ theme }) => theme.surface.floatWhite} transparent
    transparent transparent;
`

import { CSSProperties, forwardRef, ReactNode } from 'react'
import styled, { css } from 'styled-components'

import { tm } from '🙌/utils/theme'
import { floatingDropShadow } from '🙌/utils/mixins'

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
          border-radius: 4px;
          ${tm((o) => [o.bg.surface3, o.font.text1])}
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
  border-color: ${({ theme }) => theme.color.surface3} transparent transparent
    transparent;
  ${floatingDropShadow}
`

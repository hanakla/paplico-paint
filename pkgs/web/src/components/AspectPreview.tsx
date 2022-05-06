import { fit } from 'object-fit-math'
import { rgba } from 'polished'
import { ReactNode } from 'react'
import { css } from 'styled-components'
import { centering } from '../utils/mixins'

export const AspectPreview = ({
  width,
  height,
  maxWidth,
  maxHeight,
  dotted = false,
  children,
}: {
  width: number
  height: number
  maxWidth: number
  maxHeight: number
  dotted?: boolean
  children?: ReactNode
}) => {
  const size = fit(
    { width: maxWidth, height: maxHeight },
    { width, height },
    'contain'
  )

  return (
    <div
      css={`
        position: relative;
        ${centering()}
        width: 100%;
        text-align: center;
        padding: 8px;
        border: 2px solid ${rgba('#aaa', 0.5)};
        border-radius: 8px;
        background-color: #fff;

        ${dotted &&
        css`
          border-style: dashed;
          background-color: transparent;
        `}

        &::before {
          content: '';
          display: block;
          padding-top: ${(height / width) * 100}%;
        }
      `}
      style={{
        width: size.width,
        height: size.height,
      }}
    >
      <div
        css={`
          ${centering()}
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        `}
      >
        {children}
      </div>
    </div>
  )
}

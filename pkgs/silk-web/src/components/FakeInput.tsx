import { rgba } from 'polished'
import { forwardRef, DetailedHTMLProps, InputHTMLAttributes } from 'react'
import { css } from 'styled-components'
import { media } from '../utils/responsive'

export const FakeInput = forwardRef<
  HTMLInputElement,
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
>((props, ref) => {
  return (
    <input
      ref={ref}
      css={css`
        width: 100%;
        padding: 4px 2px;
        appearance: none;
        background-color: transparent;
        border: none;
        border-radius: 2px;
        color: inherit;
        outline: none;
        font-size: inherit;
        background-color: ${({ theme }) => theme.colors.whiteFade10};
        color: ${({ theme }) => theme.color.text1};

        &::placeholder {
          color: ${({ theme }) => theme.color.text2};
        }

        ${media.narrow`
          font-size: 16px;
        `}

        &:focus {
          color: ${({ theme }) => theme.text.inputActive};
          background-color: ${({ theme }) => theme.colors.whiteFade20};
        }
      `}
      type="text"
      {...props}
    />
  )
})

import { rgba } from 'polished'
import { forwardRef, DetailedHTMLProps, InputHTMLAttributes } from 'react'
import { css } from 'styled-components'
import { media } from '../utils/responsive'
import { tm } from '../utils/theme'

export const TextInput = forwardRef<
  HTMLInputElement,
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
>((props, ref) => {
  return (
    <input
      ref={ref}
      css={css`
        width: 100%;
        padding: 8px 4px;
        appearance: none;
        background-color: transparent;
        border: none;
        border-radius: 2px;
        color: inherit;
        outline: none;

        ${tm((o) => [o.bg.surface3, o.typography(14)])}

        &::placeholder {
          color: ${({ theme }) => theme.colors.whiteFade50};
        }

        ${media.narrow`
          font-size: 16px;
        `}

        &:focus {
          color: ${({ theme }) => theme.text.inputActive};
          /* background-color: ${({ theme }) => theme.colors.whiteFade20}; */
        }
      `}
      type="text"
      {...props}
    />
  )
})

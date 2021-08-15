import { forwardRef, DetailedHTMLProps, InputHTMLAttributes } from 'react'
import { css } from 'styled-components'
import { useMedia } from '../utils/hooks'
import { narrow } from '../utils/responsive'

export const FakeInput = forwardRef<
  HTMLInputElement,
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
>((props, ref) => {
  const isNarrow = useMedia(`(max-width: ${narrow})`, false)

  return (
    <input
      ref={ref}
      css={css`
        width: 100%;
        margin-top: -2px;
        padding: 2px;
        appearance: none;
        background-color: transparent;
        border: none;
        border-radius: 2px;
        color: inherit;
        outline: none;
        font-size: ${isNarrow ? '16px' : 'inherit'};

        &:focus,
        &:active {
          color: ${({ theme }) => theme.text.inputActive};
          background-color: ${({ theme }) => theme.surface.inputActive};
        }
      `}
      type="text"
      {...props}
    />
  )
})

import { forwardRef, DetailedHTMLProps, InputHTMLAttributes } from 'react'

export const FakeInput = forwardRef<
  HTMLInputElement,
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
>((props, ref) => {
  return (
    <input
      ref={ref}
      css={`
        width: 100%;
        margin-top: -2px;
        padding: 2px;
        appearance: none;
        background-color: transparent;
        border: none;
        border-radius: 2px;
        color: inherit;
        outline: none;

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

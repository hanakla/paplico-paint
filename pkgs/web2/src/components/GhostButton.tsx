import { DetailedHTMLProps, forwardRef, memo } from 'react'
import { css } from 'styled-components'

type Props = DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>

export const GhostButton = memo(
  forwardRef<HTMLButtonElement, Props>(function GhostButton(props, ref) {
    return (
      <button
        css={css`
          display: block;
          appearance: none;
          background-color: transparent;
          border: none;
          padding: 0;
        `}
        ref={ref}
        type={props.type ?? 'button'}
        {...props}
      />
    )
  }),
)

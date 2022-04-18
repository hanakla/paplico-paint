import { DetailedHTMLProps, forwardRef, InputHTMLAttributes, memo } from 'react'
import { rangeThumb } from '🙌/utils/mixins'

type Props = DetailedHTMLProps<
  InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>

export const RangeInput = memo(
  forwardRef<HTMLInputElement, Props>((props, ref) => {
    return (
      <input
        {...props}
        ref={ref}
        type="range"
        css={`
          ${rangeThumb}

          &:checked {
            opacity: 0;
          }
        `}
      />
    )
  })
)

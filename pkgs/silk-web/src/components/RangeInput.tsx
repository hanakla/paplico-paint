import { useFunk } from '@hanakla/arma'
import { debounce } from 'debounce'
import {
  ChangeEvent,
  DetailedHTMLProps,
  forwardRef,
  InputHTMLAttributes,
  memo,
  useMemo,
} from 'react'
import { rangeThumb } from '🙌/utils/mixins'

type Props = DetailedHTMLProps<
  InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & {
  onChangeComplete?: (e: ChangeEvent<HTMLInputElement>) => void
}

export const RangeInput = memo(
  forwardRef<HTMLInputElement, Props>(
    ({ onChange, onChangeComplete, ...props }, ref) => {
      const handleChangeComplete = useMemo(
        () =>
          debounce((e: ChangeEvent<HTMLInputElement>) => {
            onChangeComplete?.(e)
          }, 700),
        [onChangeComplete]
      )

      const handleChange = useFunk((e: ChangeEvent<HTMLInputElement>) => {
        onChange?.(e)
        handleChangeComplete?.(e)
      })

      return (
        <input
          {...props}
          onChange={handleChange}
          ref={ref}
          type="range"
          css={`
            ${rangeThumb}
            width: 100%;
            outline: none;

            &:checked {
              opacity: 0;
            }
          `}
        />
      )
    }
  )
)

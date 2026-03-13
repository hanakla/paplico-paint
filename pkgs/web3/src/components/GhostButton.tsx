import { DetailedHTMLProps, forwardRef, memo } from 'react'
import { twx } from '@/utils/tailwind'

type Props = DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>

export const GhostButton = memo(
  forwardRef<HTMLButtonElement, Props>(function GhostButton(props, ref) {
    const { className, ...restProps } = props

    return (
      <button
        className={twx(
          'block appearance-none bg-transparent border-0 p-0',
          className,
        )}
        ref={ref}
        type={props.type ?? 'button'}
        {...restProps}
      />
    )
  }),
)

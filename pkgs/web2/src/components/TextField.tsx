import { useFunk } from '@hanakla/arma'
import { rgba } from 'polished'
import {
  forwardRef,
  DetailedHTMLProps,
  InputHTMLAttributes,
  KeyboardEvent,
  memo,
  ReactNode,
  ComponentProps,
} from 'react'
import { css } from 'styled-components'
// import { media } from '../utils/responsive'
// import { ThemeProp, tm } from '../utils/theme'
import { TextField as _TextField } from '@radix-ui/themes'

type Props = {
  preIcon?: ReactNode
  postIcon?: ReactNode

  onComplete?: (e: KeyboardEvent<HTMLInputElement>) => void
} & ComponentProps<typeof _TextField.Input>

export const TextField = memo(
  forwardRef<HTMLInputElement, Props>(function TextField(
    { preIcon, postIcon, onComplete, ...props },
    ref,
  ) {
    const handleKeyDown = useFunk((e: KeyboardEvent<HTMLInputElement>) => {
      props.onKeyDown?.(e)
      if (!e.nativeEvent.isComposing && e.key === 'Enter') onComplete?.(e)
    })

    return (
      <_TextField.Root>
        {preIcon && <_TextField.Slot>{preIcon}</_TextField.Slot>}
        <_TextField.Input ref={ref} {...props} onKeyDown={handleKeyDown} />
        {postIcon && <_TextField.Slot>{postIcon}</_TextField.Slot>}
      </_TextField.Root>
    )

    // return (
    //   // <input
    //   //   ref={ref}
    //   //   // css={css`
    //   //   //   width: 100%;
    //   //   //   padding: 8px 4px;
    //   //   //   appearance: none;
    //   //   //   background-color: transparent;
    //   //   //   border: none;
    //   //   //   border-radius: 2px;
    //   //   //   color: inherit;
    //   //   //   outline: none;

    //   //   //   /* ${tm((o) => [o.bg.surface3, o.typography(14)])} */

    //   //   //   /* &::placeholder {
    //   //   //     color: ${({ theme }: ThemeProp) => theme.colors.whiteFade50};
    //   //   //   } */

    //   //   //   ${
    //   //   //     sizing === 'sm' &&
    //   //   //     css`
    //   //   //       padding: 4px 2px;
    //   //   //       font-size: 14px;
    //   //   //     `
    //   //   //   }

    //   //   //   /* ${media.narrow`
    //   //   //     font-size: 16px;
    //   //   //   `} */

    //   //   //   /* &:focus {
    //   //   //     color: ${({ theme }: ThemeProp) => theme.text.inputActive};
    //   //   //     /* background-color: ${({ theme }) => theme.colors.whiteFade20}; */
    //   //   //   } */
    //   //   // `}
    //   //   type="text"
    //   //   {...props}
    //   //   onKeyDown={handleKeyDown}
    //   // />
    //   <TextFie
    // )
  }),
)

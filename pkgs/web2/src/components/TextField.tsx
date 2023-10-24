import { useFunk } from '@hanakla/arma'
import { rgba } from 'polished'
import {
  forwardRef,
  DetailedHTMLProps,
  InputHTMLAttributes,
  KeyboardEvent,
  memo,
  ReactNode,
} from 'react'
import { css } from 'styled-components'
// import { media } from '../utils/responsive'
// import { ThemeProp, tm } from '../utils/theme'
import { TextField as RTextField } from '@radix-ui/themes'

type Props = {
  sizing?: 'md' | 'sm'
  preIcon?: ReactNode
  postIcon?: ReactNode
  onComplete?: (e: KeyboardEvent<HTMLInputElement>) => void
} & DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>

export const TextField = memo(
  forwardRef<HTMLInputElement, Props>(function TextField(
    { sizing = 'md', preIcon, postIcon, onComplete, ...props },
    ref,
  ) {
    const handleKeyDown = useFunk((e: KeyboardEvent<HTMLInputElement>) => {
      props.onKeyDown?.(e)
      if (!e.nativeEvent.isComposing && e.key === 'Enter') onComplete?.(e)
    })

    return (
      <RTextField.Root>
        {preIcon && <RTextField.Slot>{preIcon}</RTextField.Slot>}
        <RTextField.Input {...props} onKeyDown={handleKeyDown} />
        {postIcon && <RTextField.Slot>{postIcon}</RTextField.Slot>}
      </RTextField.Root>
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

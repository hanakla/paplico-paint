import { ComponentProps, ReactNode, memo } from 'react'
import * as RPopover from '@radix-ui/react-popover'
import { MixerHorizontalIcon, Cross2Icon } from '@radix-ui/react-icons'
import css from 'styled-jsx/css'
import { keyframes } from 'styled-components'

type Props = {
  trigger: ReactNode
  side?: ComponentProps<typeof RPopover.Content>['side']
  className?: string
  children?: ReactNode
}

export const Popover = memo(function Popover({
  side = 'bottom',
  trigger,
  className,
  children,
}: Props) {
  return (
    <RPopover.Root>
      <RPopover.Trigger asChild className={className}>
        {trigger}
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content
          css={css`
            border-radius: 4px;
            padding: 8px;
            width: 260px;
            background-color: white;
            box-shadow:
              hsl(206 22% 7% / 35%) 0px 10px 38px -10px,
              hsl(206 22% 7% / 20%) 0px 10px 20px -15px;
            animation-duration: 400ms;
            animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
            will-change: transform, opacity;

            &:focus {
              box-shadow:
                hsl(206 22% 7% / 35%) 0px 10px 38px -10px,
                hsl(206 22% 7% / 20%) 0px 10px 20px -15px,
                0 0 0 2px var(--teal-5);
            }
            &[data-state='open'][data-side='top'] {
              animation-name: ${kf.slideDownAndFade};
            }
            &[data-state='open'][data-side='right'] {
              animation-name: ${kf.slideLeftAndFade};
            }
            &[data-state='open'][data-side='bottom'] {
              animation-name: ${kf.slideUpAndFade};
            }
            &[data-state='open'][data-side='left'] {
              animation-name: ${kf.slideRightAndFade};
            }
          `}
          sideOffset={5}
          side={side}
        >
          {children}
          {/* <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="Text" style={{ marginBottom: 10 }}>
              Dimensions
            </p>
            <fieldset className="Fieldset">
              <label className="Label" htmlFor="width">
                Width
              </label>
              <input className="Input" id="width" defaultValue="100%" />
            </fieldset>
            <fieldset className="Fieldset">
              <label className="Label" htmlFor="maxWidth">
                Max. width
              </label>
              <input className="Input" id="maxWidth" defaultValue="300px" />
            </fieldset>
            <fieldset className="Fieldset">
              <label className="Label" htmlFor="height">
                Height
              </label>
              <input className="Input" id="height" defaultValue="25px" />
            </fieldset>
            <fieldset className="Fieldset">
              <label className="Label" htmlFor="maxHeight">
                Max. height
              </label>
              <input className="Input" id="maxHeight" defaultValue="none" />
            </fieldset>
          </div> */}

          {/* <RPopover.Close css={s.close} aria-label="Close">
            <Cross2Icon />
          </RPopover.Close> */}
          <RPopover.Arrow css={s.arrow} />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  )
})

const kf = {
  slideUpAndFade: keyframes`
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  `,

  slideRightAndFade: keyframes`
    from {
      opacity: 0;
      transform: translateX(-2px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  `,

  slideDownAndFade: keyframes`
    from {
      opacity: 0;
      transform: translateY(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  `,

  slideLeftAndFade: keyframes`
    from {
      opacity: 0;
      transform: translateX(2px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  `,
}

const s = {
  root: css`
    button,
    fieldset,
    input {
      all: unset;
    }
  `,
  // content: ,
  arrow: css`
    fill: white;
  `,
  close: css`
    font-family: inherit;
    border-radius: 100%;
    height: 25px;
    width: 25px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--violet-11);
    position: absolute;
    top: 5px;
    right: 5px;

    &:hover {
      background-color: var(--violet-4);
    }
    &:focus {
      box-shadow: 0 0 0 2px var(--violet-7);
    }
  `,
  iconButton: css`
    font-family: inherit;
    border-radius: 100%;
    height: 35px;
    width: 35px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--violet-11);
    background-color: white;
    box-shadow: 0 2px 10px var(--black-a7);

    &hover {
      background-color: var(--violet-3);
    }
    &focus {
      box-shadow: 0 0 0 2px black;
    }
  `,

  // .Fieldset {
  //   display: flex;
  //   gap: 20px;
  //   align-items: center;
  // }

  // .Label {
  //   font-size: 13px;
  //   color: var(--violet-11);
  //   width: 75px;
  // }

  // .Input {
  //   width: 100%;
  //   display: inline-flex;
  //   align-items: center;
  //   justify-content: center;
  //   flex: 1;
  //   border-radius: 4px;
  //   padding: 0 10px;
  //   font-size: 13px;
  //   line-height: 1;
  //   color: var(--violet-11);
  //   box-shadow: 0 0 0 1px var(--violet-7);
  //   height: 25px;
  // }
  // .Input:focus {
  //   box-shadow: 0 0 0 2px var(--violet-8);
  // }

  // .Text {
  //   margin: 0;
  //   color: var(--mauve-12);
  //   font-size: 15px;
  //   line-height: 19px;
  //   font-weight: 500;
  // }
}

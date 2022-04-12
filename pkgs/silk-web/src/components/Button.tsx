import { More } from '@styled-icons/remix-fill'
import {
  ButtonHTMLAttributes,
  MouseEvent,
  DetailedHTMLProps,
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useRef,
} from 'react'
import { usePopper } from 'react-popper'
import { useClickAway, useToggle } from 'react-use'
import { css } from 'styled-components'
import { darken, rgba } from 'polished'
import { combineRef } from '../utils/react'
import { Portal } from './Portal'
import { useFunk } from '@hanakla/arma'
import { isEventIgnoringTarget } from '🙌/features/Paint/helpers'

type Props = {
  kind: 'normal' | 'primary'
  outline?: boolean
  popup?: ReactNode
  children?: ReactNode
}

type AllProps = Props &
  DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ kind, outline, children, popup, ...props }: AllProps, ref) => {
    const rootRef = useRef<HTMLButtonElement | null>(null)
    const popperRef = useRef<HTMLDivElement | null>(null)
    const popper = usePopper(rootRef.current, popperRef.current, {
      placement: 'bottom-start',
      strategy: 'fixed',
    })
    const [openPopup, togglePopup] = useToggle(false)

    const handleOpenPopup = useFunk((e: MouseEvent) => {
      e.stopPropagation()
      togglePopup()
    })

    useClickAway(popperRef, (e) => {
      if (isEventIgnoringTarget(e.target)) return
      togglePopup(false)
    })

    return (
      <button
        ref={combineRef(rootRef, ref)}
        css={`
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0;

          appearance: none;
          text-align: center;
          border: none;
          border-radius: 4px;
          line-height: 14px;

          ${!outline && kind === 'primary' && primary}
          ${outline && kind === 'primary' && primaryOutline}
        `}
        {...props}
      >
        <div
          css={`
            padding: 8px;
          `}
        >
          {children}
        </div>

        {popup && (
          <>
            <div
              css={css`
                padding: 5px 2px;
                border-left: 1px solid var(--border-color);
                flex: 1;

                &:hover {
                  background-color: ${({ theme }) =>
                    theme.exactColors.blackFade40};
                }
              `}
              onClick={handleOpenPopup}
            >
              <More
                css={`
                  width: 20px;
                  margin: 0 2px;
                `}
              />
            </div>

            <Portal>
              <div
                ref={popperRef}
                css={css`
                  position: fixed;
                  overflow: hidden;
                  background-color: ${({ theme }) =>
                    theme.exactColors.whiteFade40};
                  filter: drop-shadow(0 0 5px ${rgba('#000', 0.5)});
                  border-radius: 4px;
                `}
                style={{
                  ...popper.styles.popper,
                  ...(openPopup
                    ? { visibility: 'visible', pointerEvents: 'all' }
                    : { visibility: 'hidden', pointerEvents: 'none' }),
                }}
                {...popper.attributes.popper}
              >
                {popup}
              </div>
            </Portal>
          </>
        )}
      </button>
    )
  }
)

const primary = css`
  --border-color: ${({ theme }) => theme.exactColors.blue50};

  background-color: ${({ theme }) => theme.exactColors.blue50};
  color: ${({ theme }) => theme.exactColors.white50};

  &:hover {
    --border-color: ${({ theme }) => darken(0.2, theme.exactColors.blue50)};
    color: ${({ theme }) => theme.exactColors.white50};
    background-color: var(--border-color);
  }
`

const primaryOutline = css`
  --border-color: ${({ theme }) => theme.exactColors.blue50};

  border: ${({ theme }) => `1px solid ${theme.exactColors.blue50}`};
  background-color: transparent;
  color: ${({ theme }) => theme.exactColors.blue50};

  &:hover {
    --border-color: ${({ theme }) => darken(0.2, theme.exactColors.blue50)};
    color: ${({ theme }) => theme.exactColors.white50};
    background-color: ${({ theme }) => theme.exactColors.blue50};
  }
`

import { RiCloseFill } from 'react-icons/ri'
import { rgba } from 'polished'
import {
  createContext,
  DetailedHTMLProps,
  forwardRef,
  HTMLAttributes,
  KeyboardEvent,
  memo,
  MouseEvent,
  ReactNode,
  useContext,
} from 'react'
import { animated, useSpring } from 'react-spring'
import { css } from 'styled-components'
import { DOMUtils } from '@/utils/dom'
import { centering } from '@/utils/cssMixin'
import useEvent from 'react-use-event-hook'
import { FocusTrap } from '@/components/FocusTrap'
import { GhostButton } from '@/components/GhostButton'
import { Portal } from '@radix-ui/themes'

type Props = {
  opened: boolean
  className?: string
  heading?: ReactNode
  children?: ReactNode
  fill?: boolean
  backdrop?: boolean
  onClose: () => void
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>

const ActionSheetContext = createContext<'fill' | 'split'>(null)

export const ActionSheet = memo(
  forwardRef<HTMLDivElement, Props>(function ActionSheet(
    {
      opened,
      fill = true,
      backdrop = true,
      heading,
      children,
      className,
      onClose,
      ...props
    },
    ref,
  ) {
    const styles = useSpring({
      config: {
        duration: 150,
      },
      opacity: opened ? 1 : 0,
      transform: opened
        ? 'translateX(-50%) translateY(0%)'
        : 'translateX(-50%) translateY(100%)',
    })

    const backdropStyle = useSpring({
      config: {
        duration: 150,
      },
      opacity: opened ? 1 : 0,
    })

    const handleClickBackdrop = useEvent((e: MouseEvent<HTMLDivElement>) => {
      console.log(e.target, e.currentTarget)
      if (!DOMUtils.isSameElement(e.target, e.currentTarget)) return
      onClose()
    })

    const handleClickClose = useEvent(() => {
      onClose()
    })

    return (
      <ActionSheetContext.Provider value={fill ? 'fill' : 'split'}>
        <FocusTrap paused={!opened}>
          <div {...props} {...(fill ? { 'data-state-filled': true } : {})}>
            {backdrop && (
              <animated.div
                // backdrop
                css={css`
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100vw;
                  height: 100vh;
                  z-index: 1;
                  background-color: ${rgba('#000', 0.5)};
                `}
                style={{
                  ...backdropStyle,
                  pointerEvents: opened ? 'all' : 'none',
                }}
                onClick={handleClickBackdrop}
              />
            )}
            <animated.div
              ref={ref}
              css={css`
                position: fixed;
                left: 50%;
                bottom: 0;
                z-index: 2;
                display: flex;
                flex-flow: column;
                width: 100%;
                max-width: 400px;
                padding: 12px;
                padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
                overflow: auto;
                filter: drop-shadow(0 0 16px ${rgba('#000', 0.2)});

                ${fill &&
                css`
                  min-height: 50vh;
                  box-shadow: 0 0 8px ${rgba('#000', 0.2)};
                  backdrop-filter: blur(8px);
                  border-radius: 4px;
                `};
              `}
              style={{
                ...styles,
                pointerEvents: opened ? 'all' : 'none',
                backgroundColor: fill ? 'var(--gray-2)' : 'transparent',
                // color: fill ? theme.exactColors.black50 : 'transparent',
              }}
              className={className}
            >
              <div>
                <div
                  css={css`
                    position: sticky;
                    display: flex;
                    margin-bottom: 12px;
                    ${centering({ x: false, y: true })}
                  `}
                >
                  <div>{heading}</div>
                  <GhostButton
                    css={css`
                      right: 8px;
                      display: flex;
                      margin-left: auto;
                      align-items: center;
                      justify-content: center;
                      padding: 4px;
                      background-color: ${rgba('#000', 0.1)};
                      border-radius: 32px;

                      &:where(:not([data-state-filled])) {
                        background-color: white;

                        &:hover {
                          background-color: var(--accent-3);
                        }
                      }
                    `}
                    onClick={handleClickClose}
                  >
                    <RiCloseFill
                      size={24}
                      css={css`
                        opacity: 0.4;
                        fill: var(--gray-12);
                      `}
                    />
                  </GhostButton>
                </div>

                <div
                  css={css`
                    flex: 1;
                  `}
                  tabIndex={-1}
                >
                  {children}
                </div>
              </div>
            </animated.div>
          </div>
        </FocusTrap>
      </ActionSheetContext.Provider>
    )
  }),
)

export const ActionSheetItemGroup = ({
  children,
  className,
}: {
  className?: string
  children: ReactNode
}) => {
  const sheetType = useContext(ActionSheetContext)

  return (
    <div
      css={css`
        /* background-color: {({ theme }) => theme.exactColors.white60}; */
        backdrop-filter: blur(8px);
        border-radius: 4px;
        overflow: hidden;

        ${sheetType === 'split' &&
        css`
          box-shadow: 0 0 5px ${rgba('#000', 0.5)};
        `}

        & + & {
          margin-top: 8px;
        }
      `}
      className={className}
    >
      {children}
    </div>
  )
}

export const ActionSheetItem = ({
  children,
  ...props
}: {
  children: ReactNode
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => {
  const onKeydown = useEvent((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.currentTarget.click()
    }
  })

  return (
    <div
      css={css`
        padding: 20px;
        text-align: center;
        font-size: 18px;
        font-weight: var(--font-weight-medium);
        user-select: none;

        &:where(:not([data-state-filled])) {
          background-color: var(--gray-2);
          border-radius: 8px;

          &:hover {
            background-color: var(--accent-3);
          }
        }

        & + & {
          border-top: 1px solid ${rgba('#333', 0.3)};
        }
      `}
      {...props}
      onKeyDown={onKeydown}
      tabIndex={0}
    >
      {children}
    </div>
  )
}

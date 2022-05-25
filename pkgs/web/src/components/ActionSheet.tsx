import { Close, Polaroid } from '@styled-icons/remix-fill'
import { rgba } from 'polished'
import {
  createContext,
  DetailedHTMLProps,
  forwardRef,
  HTMLAttributes,
  MouseEvent,
  ReactNode,
  useContext,
} from 'react'
import { styleWhen, useFunk } from '@hanakla/arma'
import { animated, useSpring } from 'react-spring'
import { css, useTheme } from 'styled-components'
import { DOMUtils } from '🙌/utils/dom'
import { tm } from '../utils/theme'

type Props = {
  opened: boolean
  className?: string
  children?: ReactNode
  fill?: boolean
  backdrop?: boolean
  onClose: () => void
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>

const ActionSheetContext = createContext<'fill' | 'split'>(null)

export const ActionSheet = forwardRef<HTMLDivElement, Props>(
  (
    {
      opened,
      fill = true,
      backdrop = true,
      children,
      className,
      onClose,
      ...props
    },
    ref
  ) => {
    const theme = useTheme()
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

    const handleClickBackdrop = useFunk((e: MouseEvent<HTMLDivElement>) => {
      if (!DOMUtils.isSameElement(e.target, e.currentTarget)) return
      onClose()
    })

    const handleClickClose = useFunk(() => {
      onClose()
    })

    return (
      <ActionSheetContext.Provider value={fill ? 'fill' : 'split'}>
        <div {...props}>
          {backdrop && (
            // @ts-expect-error
            <animated.div
              // backdrop
              css={`
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
            css={`
              position: fixed;
              left: 50%;
              bottom: 0;
              z-index: 2;
              display: flex;
              flex-flow: column;
              width: 100%;
              max-width: 400px;
              padding: 12px;
              padding-bottom: env(safe-area-inset-bottom, 16px);
              overflow: auto;

              ${styleWhen(fill)`
                min-height: 50vh;
                box-shadow: 0 0 8px ${rgba('#000', 0.2)};
                backdrop-filter: blur(8px);
                border-radius: 4px;
              `}
            `}
            style={{
              ...styles,
              pointerEvents: opened ? 'all' : 'none',
              backgroundColor: fill ? theme.exactColors.white50 : 'transparent',
              // color: fill ? theme.exactColors.black50 : 'transparent',
            }}
            className={className}
          >
            <div
              css={`
                position: sticky;
                top: 8px;
                right: 8px;
                display: flex;
                margin-left: auto;
                align-items: center;
                justify-content: center;
                padding: 4px;
                background-color: ${rgba('#000', 0.1)};
                border-radius: 32px;
              `}
              onClick={handleClickClose}
            >
              <Close
                css={`
                  width: 24px;
                  opacity: 0.4;
                `}
              />
            </div>

            <div
              css={`
                flex: 1;
              `}
            >
              {children}
            </div>
          </animated.div>
        </div>
      </ActionSheetContext.Provider>
    )
  }
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
        background-color: ${({ theme }) => theme.exactColors.white60};
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
  return (
    <div
      css={`
        padding: 20px;
        text-align: center;
        font-size: 18px;
        /* font-weight: 600; */

        ${tm((o) => [o.font.primary])}

        & + & {
          border-top: 1px solid ${rgba('#333', 0.3)};
        }
      `}
      {...props}
    >
      {children}
    </div>
  )
}

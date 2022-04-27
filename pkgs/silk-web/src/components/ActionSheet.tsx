import { Close, Polaroid } from '@styled-icons/remix-fill'
import { rgba } from 'polished'
import {
  DetailedHTMLProps,
  forwardRef,
  HTMLAttributes,
  MouseEvent,
  ReactNode,
} from 'react'
import { styleWhen, useFunk } from '@hanakla/arma'
import { animated, useSpring } from 'react-spring'
import { css, useTheme } from 'styled-components'
import { DOMUtils } from '🙌/utils/dom'

type Props = {
  opened: boolean
  className?: string
  children?: ReactNode
  fill?: boolean
  onClose: () => void
}

export const ActionSheet = forwardRef<HTMLDivElement, Props>(
  ({ opened, fill = true, children, className, onClose }, ref) => {
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
      <div>
        {/* @ts-expect-error */}
        <animated.div
          // backdrop
          css={`
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: ${rgba('#000', 0.5)};
          `}
          style={{ ...backdropStyle, pointerEvents: opened ? 'all' : 'none' }}
          onClick={handleClickBackdrop}
        />
        <animated.div
          ref={ref}
          css={css`
            position: fixed;
            left: 50%;
            bottom: 0;
            width: 100%;
            max-width: 400px;
            padding: 12px;
            padding-bottom: max(env(safe-area-inset-bottom), 16px);
            overflow: hidden;

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
            backgroundColor: fill ? theme.color.surface9 : 'transparent',
          }}
          className={className}
        >
          <div
            css={`
              position: absolute;
              top: 8px;
              right: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
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

          <div>{children}</div>
        </animated.div>
      </div>
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
  let a = `${() => ''}`

  return (
    <div
      css={css`
        background-color: ${({ theme }) => theme.surface.floatWhite};
        box-shadow: 0 0 5px ${rgba('#000', 0.5)};
        backdrop-filter: blur(4px);
        border-radius: 4px;
        overflow: hidden;

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
        font-size: 16px;
        font-weight: 400;

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

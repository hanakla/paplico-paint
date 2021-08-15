import { Close, Polaroid } from '@styled-icons/remix-fill'
import { rgba } from 'polished'
import { forwardRef, useCallback, ReactNode } from 'react'
import { styleWhen } from '@hanakla/arma'
import { animated, useSpring } from 'react-spring'
import { css, useTheme } from 'styled-components'

type Props = {
  opened: boolean
  children?: ReactNode
  fill?: boolean
  onClose: () => void
}

export const ActionSheet = forwardRef<HTMLDivElement, Props>(
  ({ opened, fill = true, children, onClose }, ref) => {
    const theme = useTheme()
    const styles = useSpring({
      config: {
        duration: 150,
      },
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

    const handleClickClose = useCallback(() => {
      onClose()
    }, [onClose])

    return (
      <div>
        <animated.div
          css={`
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: ${rgba('#000', 0.1)};
          `}
          style={{ ...backdropStyle, pointerEvents: opened ? 'all' : 'none' }}
        />
        <animated.div
          ref={ref}
          css={css`
            position: fixed;
            left: 50%;
            bottom: 0;
            width: 100vw;
            max-width: 400px;
            min-height: 40vh;
            padding: 8px;
            padding-bottom: env(safe-area-inset-bottom);
            overflow: hidden;

            ${styleWhen(fill)`
              min-height: 40vh;
              box-shadow: 0 0 5px ${rgba('#000', 0.5)};
              backdrop-filter: blur(4px);
              border-radius: 4px;
            `}
          `}
          style={{
            ...styles,
            pointerEvents: opened ? 'all' : 'none',
            backgroundColor: fill ? theme.surface.floatWhite : 'transparent',
          }}
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
  return (
    <div
      css={`
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
  className,
}: {
  className?: string
  children: ReactNode
}) => {
  return (
    <div
      css={`
        padding: 20px;
        text-align: center;
        font-size: 16px;

        + & {
          border-top: 1px solid ${rgba('#000', .5)}
        }
      `}
      className={className}
    >
      {children}
    </div>
  )
}

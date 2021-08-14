import { rgba } from 'polished'
import { ReactNode } from 'react'
import { animated, useSpring } from 'react-spring'
import { css } from 'styled-components'

export const ActionSheet = ({
  children,
  opened,
}: {
  children: ReactNode
  opened: boolean
}) => {
  const props = useSpring(
    opened
      ? { transform: 'translate(-50%, 0%);' }
      : { transform: 'translate(-50%, 100%);' }
  )

  return (
    <animated.div
      css={`
        position: fixed;
        left: 50%;
        bottom: 0;
        width: 100vw;
        max-width: 400px;
        padding: 16px;
      `}
      style={props}
    >
      <div
        css={css`
          background-color: ${({ theme }) => theme.surface.floatWhite};
          box-shadow: 0 0 5px ${rgba('#000', 0.5)};
          backdrop-filter: blur(4px);
        `}
      >
        {children}
      </div>
    </animated.div>
  )
}

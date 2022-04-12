import { ReactNode } from 'react'
import { css } from 'styled-components'
import { centering } from '🙌/utils/mixins'

type Props = {
  className?: string
  heading: ReactNode
  children: ReactNode
  container?: (children: ReactNode) => ReactNode
}

const defaultContainer = (children: ReactNode) => (
  <div
    css={`
      padding: 4px;
    `}
  >
    {children}
  </div>
)

export const SidebarPane = ({
  heading,
  children,
  className,
  container = defaultContainer,
}: Props) => {
  return (
    <section
      css={`
        display: flex;
        flex-flow: column;
        flex: 1;

        & + & {
          border-top: 1px solid ${({ theme }) => theme.exactColors.blackFade30};
        }
      `}
    >
      <header
        css={css`
          position: relative;
          display: flex;
          padding: 6px;

          border-bottom: 1px solid
            ${({ theme }) => theme.exactColors.blackFade30};
        `}
      >
        {heading}
      </header>

      {container(children)}
    </section>
  )
}

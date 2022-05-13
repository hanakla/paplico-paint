import { ReactNode } from 'react'
import { css } from 'styled-components'
import { centering } from '🙌/utils/mixins'
import { tm } from '../utils/theme'

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
          ${tm((o) => [o.border.default.top])}
        }
      `}
    >
      <header
        css={css`
          position: relative;
          display: flex;
          padding: 6px;
          ${tm((o) => [o.border.default.bottom])}
        `}
      >
        {heading}
      </header>

      {container(children)}
    </section>
  )
}

import { ReactNode } from 'react'
import { css } from 'styled-components'
import { centering } from '🙌/utils/mixins'

type Props = {
  className?: string
  heading: ReactNode
  children: ReactNode
}

export const SidebarPane = ({ heading, children, className }: Props) => {
  return (
    <section
      css={`
        display: flex;
        flex-flow: column;
        flex: 1;
      `}
    >
      <header
        css={css`
          ${centering()}
          position: relative;
          display: flex;
          padding: 6px;
          border-top: 1px solid ${({ theme }) => theme.exactColors.blackFade30};
          border-bottom: 1px solid
            ${({ theme }) => theme.exactColors.blackFade30};
        `}
      >
        {heading}
      </header>
      <div>{children}</div>
    </section>
  )
}

import { styleWhen, useFunk } from '@hanakla/arma'
import { FC, ReactNode } from 'react'
import { css } from 'styled-components'
import { tm } from '🙌/utils/theme'

export const TabBar = ({ children }: { children: ReactNode }) => {
  return (
    <div
      css={`
        display: flex;
        ${tm((o) => [o.bg.surface6, o.font.text5])}
      `}
      role="tablist"
    >
      {children}
    </div>
  )
}

export const Tab: FC<{
  tabName: string
  active: boolean
  onClick: (tabName: string) => void
}> = ({ tabName, active, onClick, children }) => {
  const handleClickTab = useFunk(() => onClick(tabName))

  return (
    <div
      css={`
        display: block;
        padding: 4px;
      `}
      role="tab"
      onClick={handleClickTab}
    >
      <span
        css={css`
          display: inline-block;
          padding: 4px;
          border-bottom: 1px solid transparent;
          ${active &&
          css`
            border-bottom-color: ${({ theme }) => theme.color.text5};
          `}
        `}
      >
        {children}
      </span>
    </div>
  )
}

import { styleWhen, useFunk } from '@hanakla/arma'
import { FC, ReactNode } from 'react'
import { css } from 'styled-components'
import { tm } from '🙌/utils/theme'

export const TabBar = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => {
  return (
    <div
      css={`
        display: flex;
        ${tm((o) => [o.font.text1])}
      `}
      role="tablist"
      className={className}
    >
      {children}
    </div>
  )
}

export const Tab: FC<{
  tabName?: string
  active?: boolean
  onClick?: (tabName: string) => void
}> = ({ tabName, active, onClick, children }) => {
  const handleClickTab = useFunk(() => tabName && onClick?.(tabName))

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
            border-bottom-color: currentColor;
          `}

          & > a {
            color: inherit;
            text-decoration: none;
          }
        `}
      >
        {children}
      </span>
    </div>
  )
}

import { memo } from 'react'
import { css } from 'styled-components'
import { BrushSettingPane } from './Floatables/BrushSettingPane'
import { LayersPane } from './Floatables/LayersPane'

type Props = {
  className?: string
}

export const LeftSideBar = memo(({ className }: Props) => {
  return (
    <div
      css={css`
        width: 240px;
        /* padding: 8px; */
        background-color: var(--gray-2);
        box-shadow: 0 0 32px rgba(0, 0, 0, 0.15);
      `}
      className={className}
    >
      <BrushSettingPane />
      <LayersPane size="sm" />
    </div>
  )
})

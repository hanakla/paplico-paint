import { memo } from 'react'
import { css } from 'styled-components'
import { BrushSettingPane } from './Floatables/BrushSettingPane'
import { LayersPane } from './Floatables/LayersPane'
import { LayerFiltersPane } from './Floatables/LayerFiltersPane'

type Props = {
  className?: string
}

export const LeftSideBar = memo(({ className }: Props) => {
  return (
    <div
      css={css`
        width: 240px;
        /* padding: 8px; */
        background-color: white;
        box-shadow: 0 0 24px rgba(0, 0, 0, 0.1);
      `}
      className={className}
    >
      <BrushSettingPane />
      <LayersPane size="sm" />
      <LayerFiltersPane />
    </div>
  )
})

import { Tab, TabList, TabContent, TabRoot } from '@/components/TabBar'
import { memo } from 'react'
import { css } from 'styled-components'

export const FillSettingPane = memo(function FillSettingPane() {
  return (
    <TabRoot defaultPage="solid">
      <TabContent pageId="solid">
        <div
          css={css`
            padding: 8px;
            margin-bottom: 8px;
          `}
        >
          {' '}
          Color
        </div>
      </TabContent>
      <TabContent pageId="gradient">
        <div
          css={css`
            padding: 8px;
            margin-bottom: 8px;
          `}
        >
          Gradient
        </div>
      </TabContent>

      <TabList>
        <Tab pageId="solid">Solid</Tab>
        <Tab pageId="gradient">Gradient</Tab>
      </TabList>
    </TabRoot>
  )
})

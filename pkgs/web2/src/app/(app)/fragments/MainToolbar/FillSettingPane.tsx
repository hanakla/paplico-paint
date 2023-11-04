import { Tab, TabList, TabContent, TabRoot, TabPage } from '@/components/TabBar'
import { memo } from 'react'
import { css } from 'styled-components'

export const FillSettingPane = memo(function FillSettingPane() {
  return (
    <TabPage.Root defaultPage="solid">
      <TabPage.Content pageId="solid">
        <div
          css={css`
            padding: 8px;
            margin-bottom: 8px;
          `}
        >
          {' '}
          Color
        </div>
      </TabPage.Content>

      <TabPage.Content pageId="gradient">
        <div
          css={css`
            padding: 8px;
            margin-bottom: 8px;
          `}
        >
          Gradient
        </div>
      </TabPage.Content>

      <TabPage.List>
        <Tab pageId="solid">Solid</Tab>
        <Tab pageId="gradient">Gradient</Tab>
      </TabPage.List>
    </TabPage.Root>
  )
})

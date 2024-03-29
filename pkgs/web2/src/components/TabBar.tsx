import React, { ComponentProps, ReactNode, memo } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { css } from 'styled-components'
// import './styles.css'

export const TabRoot = memo(function TabRoot({
  children,
  defaultPage,
  ...props
}: {
  children: ReactNode
  defaultPage?: string
} & ComponentProps<typeof Tabs.Root>) {
  return (
    <Tabs.Root defaultValue={defaultPage} {...props}>
      {children}
    </Tabs.Root>
  )
})

export const TabList = memo(function TabList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <Tabs.List className={className}>{children}</Tabs.List>
})

export const Tab = memo(function Tab({
  children,
  pageId,
  className,
}: {
  children: ReactNode
  pageId: string
  className?: string
}) {
  return (
    <Tabs.Trigger
      css={css`
        display: inline-block;
        padding: 4px;

        appearance: none;
        background: none;
        border: none;
        border-bottom: 1px solid transparent;

        &[data-state='active'] {
          border-bottom-color: currentColor;
        }

        & > a {
          color: inherit;
          text-decoration: none;
        }
      `}
      value={pageId}
      className={className}
    >
      {children}
    </Tabs.Trigger>
  )
})

export const TabContent = memo(function TabContent({
  children,
  pageId,
  value,
  ...props
}: {
  children: ReactNode
  pageId: string
  className?: string
} & Omit<ComponentProps<typeof Tabs.Content>, 'value'>) {
  return (
    <Tabs.Content value={pageId} {...props}>
      {children}
    </Tabs.Content>
  )
})

export const TabPage = {
  Root: TabRoot,
  List: TabList,
  Tab,
  Content: TabContent,
}

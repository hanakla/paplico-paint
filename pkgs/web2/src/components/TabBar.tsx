import React, { ReactNode, memo } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { css } from 'styled-components'
// import './styles.css'

export const TabRoot = memo(function TabRoot({
  children,
  defaultPage,
}: {
  children: ReactNode
  defaultPage?: string
}) {
  return <Tabs.Root defaultValue={defaultPage}>{children}</Tabs.Root>
})

export const TabList = memo(function TabList({
  children,
}: {
  children: ReactNode
}) {
  return (
    <Tabs.List className="TabsList" aria-label="Manage your account">
      {children}
    </Tabs.List>
  )
})

export const Tab = memo(function Tab({
  children,
  pageId,
}: {
  children: ReactNode
  pageId: string
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
    >
      {children}
    </Tabs.Trigger>
  )
})

export const TabContent = memo(function TabContent({
  children,
  pageId,
  className,
}: {
  children: ReactNode
  pageId: string
  className?: string
}) {
  return (
    <Tabs.Content className="TabsContent" value={pageId}>
      {children}
    </Tabs.Content>
  )
})

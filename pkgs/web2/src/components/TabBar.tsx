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
}: {
  children: ReactNode
  pageId: string
}) {
  return (
    <Tabs.Content className="TabsContent" value={pageId}>
      {children}
    </Tabs.Content>
  )
})

export const TabPage = () => (
  <Tabs.Root className="TabsRoot" defaultValue="tab1">
    <Tabs.Content className="TabsContent" value="tab1">
      <p className="Text">
        Make changes to your account here. Click save when you're done.
      </p>
      <fieldset className="Fieldset">
        <label className="Label" htmlFor="name">
          Name
        </label>
        <input className="Input" id="name" defaultValue="Pedro Duarte" />
      </fieldset>
      <fieldset className="Fieldset">
        <label className="Label" htmlFor="username">
          Username
        </label>
        <input className="Input" id="username" defaultValue="@peduarte" />
      </fieldset>
      <div
        style={{ display: 'flex', marginTop: 20, justifyContent: 'flex-end' }}
      >
        <button className="Button green">Save changes</button>
      </div>
    </Tabs.Content>
    <Tabs.Content className="TabsContent" value="tab2">
      <p className="Text">
        Change your password here. After saving, you'll be logged out.
      </p>
      <fieldset className="Fieldset">
        <label className="Label" htmlFor="currentPassword">
          Current password
        </label>
        <input className="Input" id="currentPassword" type="password" />
      </fieldset>
      <fieldset className="Fieldset">
        <label className="Label" htmlFor="newPassword">
          New password
        </label>
        <input className="Input" id="newPassword" type="password" />
      </fieldset>
      <fieldset className="Fieldset">
        <label className="Label" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input className="Input" id="confirmPassword" type="password" />
      </fieldset>
      <div
        style={{ display: 'flex', marginTop: 20, justifyContent: 'flex-end' }}
      >
        <button className="Button green">Change password</button>
      </div>
    </Tabs.Content>

    <Tabs.List className="TabsList" aria-label="Manage your account">
      <Tabs.Trigger className="TabsTrigger" value="tab1">
        Account
      </Tabs.Trigger>
      <Tabs.Trigger className="TabsTrigger" value="tab2">
        Password
      </Tabs.Trigger>
    </Tabs.List>
  </Tabs.Root>
)

import { ReactNode } from 'react'
import { DocsLayout, NavItem, SideNav } from '../_shared/layout'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      navs={
        <SideNav>
          <NavItem href="/docs/en/00c7f0d6f5ae4e82b4d907f7b383bdfc">
            User notes
          </NavItem>
          <NavItem indent={1} href="/docs/en/17829b3fb5fe493698f3b9fe65d60ce4">
            About "Ink"
          </NavItem>
          <NavItem indent={1} href="/docs/en/17829b3fb5fe493698f3b9fe65d60ce4">
            Vector Editor
          </NavItem>

          <NavItem href="/docs/en/082859a5e7b04ec68e5e2dfb1ec2c500">
            Developer docs
          </NavItem>

          <ol>
            <NavItem
              indent={1}
              href="/docs/en/17829b3fb5fe493698f3b9fe65d60ce4"
            >
              Make your own Brush
            </NavItem>

            <NavItem
              indent={1}
              href="/docs/en/17829b3fb5fe493698f3b9fe65d60ce4"
            >
              Make your own Filter
            </NavItem>
            <NavItem
              indent={1}
              href="/docs/en/17829b3fb5fe493698f3b9fe65d60ce4"
            >
              Make your own Ink
            </NavItem>

            <NavItem indent={1} href="">
              Examples
            </NavItem>

            <NavItem
              indent={2}
              href="/docs/en/d8bda7b1157d45209f8a8e29b390b04e"
            >
              Paint Chat
            </NavItem>
          </ol>
        </SideNav>
      }
    >
      {children}
    </DocsLayout>
  )
}

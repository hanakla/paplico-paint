import { ReactNode } from 'react'
import { DocsLayout, NavItem, SideNav } from '../_shared/layout'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      navs={
        <SideNav>
          <NavItem href="/docs/ja/7e3b656f66c546f9a8f865062cc078e3">
            ユーザーノート
          </NavItem>
          <NavItem indent={1} href="/docs/ja/0c67ab109a77495f9bac21a4a84728e5">
            インク
          </NavItem>
          <NavItem indent={1} href="/docs/ja/851a3216c88646f4b427e99b1d433a79">
            ベクターエディタ
          </NavItem>

          <NavItem href="/docs/ja/082859a5e7b04ec68e5e2dfb1ec2c500">
            開発者向けドキュメント
          </NavItem>

          <ol>
            <NavItem
              indent={1}
              href="/docs/ja/17829b3fb5fe493698f3b9fe65d60ce4"
            >
              ブラシを作る
            </NavItem>

            <NavItem
              indent={1}
              href="/docs/ja/17829b3fb5fe493698f3b9fe65d60ce4"
            >
              フィルターを作る
            </NavItem>
            <NavItem
              indent={1}
              href="/docs/ja/17829b3fb5fe493698f3b9fe65d60ce4"
            >
              インクを作る
            </NavItem>

            <NavItem indent={1} href="">
              @paplico/core のサンプル
            </NavItem>

            <NavItem
              indent={2}
              href="/docs/ja/d8bda7b1157d45209f8a8e29b390b04e"
            >
              お絵かきチャット
            </NavItem>
          </ol>
        </SideNav>
      }
    >
      {children}
    </DocsLayout>
  )
}

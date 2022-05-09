import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'
import { Tab, TabBar } from '../components/TabBar'

export const DevLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter()

  return (
    <div>
      <TabBar
        css={`
          margin-bottom: 8px;
        `}
      >
        <Tab active={router.asPath === '/dev/debug'}>
          <Link href="/dev/debug">debug</Link>{' '}
        </Tab>
        <Tab active={router.asPath === '/dev/webgl'}>
          <Link href="/dev/webgl">WebGL</Link>{' '}
        </Tab>
        <Tab active={router.asPath === '/dev/many-layers'}>
          <Link href="/dev/many-layers">Many layers</Link>{' '}
        </Tab>
        <Tab active={router.asPath === '/dev/bench'}>
          <Link href="/dev/bench">bench</Link>{' '}
        </Tab>
      </TabBar>
      <div>{children}</div>
    </div>
  )
}

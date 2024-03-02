'use client'
import type {} from '@/lib/cssprop'
import React, { ReactNode, memo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import '../globals.css'
import { getDatabase } from '@/infra/notion'
import Head from 'next/head'
import clsx from 'clsx'
import { tx, useTranslation } from '@/lib/i18n'

// export const metadata = {
//   title: 'Paplico Docs',
//   description: 'Paplic-o-MAGIC! Paplico is a vector magic drawing app',
// }

const texts = tx({
  en: {
    contents: 'Contents',
  },
  ja: {
    contents: 'コンテンツ',
  },
})

export const DocsLayout = memo(function DocsLayout({
  navs,
  locale,
  children,
}: {
  navs: React.ReactNode
  locale: 'en' | 'ja'
  children: React.ReactNode
}) {
  const t = useTranslation(texts, locale)
  const router = useRouter()
  const path = usePathname()

  const enPath = path.replace(/^\/docs\/.+?\//, '/docs/en')
  const jaPath = enPath.replace(/^\/docs\/.+?\//, '/docs/ja')

  // useEffect(() => {
  //   setInterval(() => {
  //     router.refresh()
  //   }, 16000)
  // }, [])

  return (
    <html lang={locale}>
      <Head>
        <link rel="alternative" href={enPath} hrefLang="en" />
        <link rel="alternative" href={jaPath} hrefLang="ja" />
      </Head>

      <body>
        <div className="flex min-h-full max-w-[1200px] m-auto">
          <nav className="flex-col w-64 min-w-max flex-none p-2 border-r-[1px] border-r-lime-400">
            <h1 className="text-4xl text-center font-bold p-2 mb-8">Paplico</h1>

            <div className="sticky top-4">
              <h2 className="mb-3 font-semibold">{t('contents')}</h2>

              {navs}
            </div>

            <div id="current-page-toc"></div>
          </nav>

          <main className="flex-aut w-full px-20 pt-20 pb-20 text-xl font-sans font-thin right-auto bg-teal-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
})

export const SideNav = memo(function SideNav({
  children,
}: {
  children: ReactNode
}) {
  return <ol className="grid ml-2">{children}</ol>
})

export const NavItem = memo(function NavItem({
  indent = 0,
  href,
  children,
}: {
  indent?: number
  href: string
  children: ReactNode
}) {
  const pathname = usePathname()

  return (
    <li
      className={clsx(
        'relative block text-sm rounded-r-full 0 transition',
        href !== '' && 'hover:bg-lime-10',
      )}
      style={{ paddingLeft: indent * 1 + 'rem' }}
    >
      <div
        role="none"
        className={clsx(
          'absolute left-0 top-0 bottom-0 border-l-[2px]',
          href != '' && pathname.startsWith(href)
            ? 'border-l-lime-500'
            : 'border-l-slate-200',
        )}
      />
      <Link href={href} className="block w-full h-full px-4 py-2">
        {children}
      </Link>
    </li>
  )
})

'use client'

import type {} from '@/lib/cssprop'
import { createGlobalStyle, css } from 'styled-components'
import reset from 'styled-reset'
import React, { useEffect } from 'react'
import { Theme } from '@radix-ui/themes'
import StyledComponentsRegistry from '@/lib/StyledComponentsRegistry'
import { ModalProvider } from '@/components/Dialog'
import '@radix-ui/themes/styles.css'
// import { LongPressEventType, useLongPress } from 'use-long-press'
import Head from 'next/head'
import { useLongPress } from 'react-use'

// export const metadata = {
//   title: 'Next.js',
//   description: 'Generated by Next.js'
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const bindLongPress = useLongPress(
    (e) => {
      if (!('touches' in e)) return

      const init: MouseEventInit = { ...e }
      init.clientX = e.touches[0].clientX
      init.clientY = e.touches[0].clientY

      e.target?.dispatchEvent(new MouseEvent('contextmenu', init))
    },
    {
      isPreventDefault: false,
    },
  )

  return (
    <html lang="en">
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="theme-color" content="#ee89b6" />

        <title>Paplico</title>
      </Head>
      <StyledComponentsRegistry>
        <Theme
          asChild
          style={{ width: '100%', height: '100%' }}
          accentColor="lime"
        >
          <body {...bindLongPress}>
            <GlobalStyle />
            <ModalProvider>{children}</ModalProvider>
          </body>
        </Theme>
      </StyledComponentsRegistry>
    </html>
  )
}

const GlobalStyle = createGlobalStyle`
  ${reset}

  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    touch-action: none;
    overflow: hidden;

    *:not(input, textarea){
      user-select: none;
      -webkit-user-select: none;
    }
  }

  :root {
    --pap-sufrace-dropshadow: rgba(0,0,0,.2);
    --pap-sufrace-dropshadow-size: 24px;
  }
`

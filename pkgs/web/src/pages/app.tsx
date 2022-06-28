import type {} from '../utils/styled-theme'
import type {} from '../declarations'

import 'react-contexify/dist/ReactContexify.css'
import React, { memo, useEffect, useMemo } from 'react'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { createGlobalStyle, ThemeProvider } from 'styled-components'
import { useFleurContext, useStore } from '@fleur/react'
import { useFleur, useMedia } from '🙌/utils/hooks'
import {
  darkWithCharcoal,
  lightWithCharcoal,
  ThemeType,
  tm,
} from '🙌/utils/theme'
import i18nConfig from '../../next-i18next.config'
import { narrow } from '🙌/utils/responsive'
import { getStaticPropsWithFleur } from '🙌/lib/fleur'
import { EditorOps, EditorStore } from '🙌/domains/EditorStable'
import { PaintPage } from '🙌/features/Paint'
import { HomeContent } from '🙌/features/Home'
import { shallowEquals } from '🙌/utils/object'
import Head from 'next/head'
import { LoadingLock } from '../containers/LoadingLock'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { LysContext } from '@fleur/lys'
import { GlobalStyle } from '../components/GlobalStyle'
import { Restart } from '@styled-icons/remix-fill'

// Index.getInitialProps = async (ctx: FleurishNextPageContext) => {
//   // await Promise.all([
//   //   ctx.executeOperation(AppOps.asyncIncrement, (Math.random() * 1000) | 0),
//   //   ctx.executeOperation(AppOps.settleAccessDate),
//   // ])

//   // return {}
//   return {}
// }

declare module 'styled-components' {
  export interface DefaultTheme extends ThemeType {}
}

const PageSwitch = memo(function PageSwitch() {
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, false)

  const { executeOperation } = useFleurContext()
  const { editorPage, currentTheme } = useStore((get) => ({
    editorPage: get(EditorStore).state.editorPage,
    currentTheme: get(EditorStore).state.currentTheme,
  }))

  useEffect(() => {
    executeOperation(EditorOps.restorePreferences)
    executeOperation(EditorOps.setEditorMode, isNarrowMedia ? 'sp' : 'pc')
  }, [])

  const theme = useMemo(
    () => (currentTheme === 'dark' ? darkWithCharcoal : lightWithCharcoal),
    [currentTheme]
  )

  return (
    <ThemeProvider theme={theme}>
      <DefaultStyle />
      <>{editorPage === 'home' ? <HomeContent /> : <PaintPage />}</>
    </ThemeProvider>
  )
})

export default function App() {
  const { execute } = useFleur()
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, false)

  useEffect(() => {
    execute(EditorOps.restorePreferences)
    execute(EditorOps.setEditorMode, isNarrowMedia ? 'sp' : 'pc')
  }, [])

  return (
    <>
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

        <link rel="manifest" href="/manifest.json" />

        <title>Paplico Paint</title>
      </Head>

      <LysContext>
        <GlobalStyle />

        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <LoadingLock />
          <PageSwitch />
        </ErrorBoundary>
      </LysContext>
    </>
  )
}

const DefaultStyle = createGlobalStyle`
  html {
    ${tm((o) => [o.bg.surface1])}
  }
`

export const getStaticProps = getStaticPropsWithFleur(async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(
        locale!,
        ['app', 'index-home'],
        i18nConfig
      )),
      // Will be passed to the page component as props
    },
  }
})

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  useEffect(() => {
    console.error('Error Fallback', error)
    setTimeout(() => resetErrorBoundary(), 1000)
  }, [])

  return (
    <div
      css={`
        position: fixed;
        top: 0;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-flow: column;
        width: 100vw;
        height: 100vh;
      `}
      onClick={() => location.reload()}
    >
      <Restart
        css={`
          width: 64px;
          color: #bdbdbd;
        `}
      />
      <div css="margin-top:32px; font-size: 24px; text-align:center;">
        🙄 <br />
        Whats happend
        <br />
        Please tap to reload page
      </div>
    </div>
  )
}

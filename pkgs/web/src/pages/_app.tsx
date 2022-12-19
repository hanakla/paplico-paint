import '🙌/lib/polyfill'

import App, { AppProps, AppContext } from 'next/app'
import { appWithTranslation } from 'next-i18next'
import { useEffect, useMemo } from 'react'
import { Restart } from '@styled-icons/remix-line'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { appWithFleur } from '../lib/fleur'
import { LysContext } from '@fleur/lys'
import { useStore } from '@fleur/react'
import { MordredRoot, Mordred } from '@fleur/mordred'
import { rgba } from 'polished'
import Head from 'next/head'

import { LoadingLock } from '🙌/containers/LoadingLock'
import { GlobalStyle } from '🙌/components/GlobalStyle'
import { darkWithCharcoal, lightWithCharcoal } from '🙌/utils/theme'
// import { EditorStore } from '🙌/domains/EditorStable'
import { ThemeProvider } from 'styled-components'

const fastclick = typeof window !== 'undefined' ? require('fastclick') : null
typeof window !== 'undefined' ? require('doubletouch-to-dblclick') : null

function MyApp({ Component, pageProps }: AppProps) {
  const { currentTheme } = useStore((get) => ({
    currentTheme: 'dark', //get(EditorStore).state.currentTheme,
  }))

  const theme = useMemo(
    () => (currentTheme === 'dark' ? darkWithCharcoal : lightWithCharcoal),
    [currentTheme]
  )

  useMemo(() => !Mordred.instance && Mordred.init(), [])

  useEffect(() => {
    fastclick?.attach(document.body)
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

      <ThemeProvider theme={theme}>
        <Component {...pageProps} />

        <MordredRoot>
          {(children) => (
            <div
              css={`
                position: fixed;
                top: 0;
                left: 0;
                display: flex;
                width: 100%;
                height: 100%;
                justify-content: center;
                z-index: 1;
                background-color: ${rgba('#000', 0.5)};
              `}
            >
              {children.children}
            </div>
          )}
        </MordredRoot>
      </ThemeProvider>
    </>
  )
}

MyApp.getInitialProps = async (context: AppContext) => {
  // calls page's `getInitialProps` and fills `appProps.pageProps`
  const appProps = await App.getInitialProps(context)

  return { ...appProps }
}

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

export default appWithTranslation(
  appWithFleur(MyApp, { enableGetIntialProps: false })
)

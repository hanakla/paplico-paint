import '🙌/lib/polyfill'

import App, { AppProps, AppContext } from 'next/app'
import { appWithTranslation } from 'next-i18next'
import { useEffect, useMemo } from 'react'
import { Restart } from '@styled-icons/remix-line'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { appWithFleur } from '../lib/fleur'
import { LysContext } from '@fleur/lys'
import { useStore } from '@fleur/react'
import Head from 'next/head'

import { LoadingLock } from '🙌/containers/LoadingLock'
import { GlobalStyle } from '🙌/components/GlobalStyle'
import { darkWithCharcoal, lightWithCharcoal } from '🙌/utils/theme'
import { EditorStore } from '🙌/domains/EditorStable'
import { ThemeProvider } from 'styled-components'

const fastclick = typeof window !== 'undefined' ? require('fastclick') : null
typeof window !== 'undefined' ? require('doubletouch-to-dblclick') : null

function MyApp({ Component, pageProps }: AppProps) {
  const { currentTheme } = useStore((get) => ({
    currentTheme: get(EditorStore).state.currentTheme,
  }))

  const theme = useMemo(
    () => (currentTheme === 'dark' ? darkWithCharcoal : lightWithCharcoal),
    [currentTheme]
  )

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
      </Head>
      <ThemeProvider theme={theme}>
        <LysContext>
          <GlobalStyle />

          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <LoadingLock />
            <Component {...pageProps} />
          </ErrorBoundary>
        </LysContext>
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
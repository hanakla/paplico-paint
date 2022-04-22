import '../lib/polyfill'

import App, { AppProps, AppContext } from 'next/app'
import { appWithTranslation } from 'next-i18next'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { Restart } from '@styled-icons/remix-line'
import { GlobalStyle } from '../components/GlobalStyle'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { appWithFleur } from '../lib/fleur'
import { LysContext } from '@fleur/lys'
import Head from 'next/head'

const fastclick = typeof window !== 'undefined' ? require('fastclick') : null
typeof window !== 'undefined' ? require('doubletouch-to-dblclick') : null

function MyApp({ Component, pageProps }: AppProps) {
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
      <LysContext>
        <GlobalStyle />

        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Component {...pageProps} />
        </ErrorBoundary>
      </LysContext>
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

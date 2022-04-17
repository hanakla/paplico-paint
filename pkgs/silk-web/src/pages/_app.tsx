import '../lib/polyfill'

import App, { AppProps, AppContext } from 'next/app'
import { appWithTranslation } from 'next-i18next'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { Restart } from '@styled-icons/remix-line'
import { GlobalStyle } from '../components/GlobalStyle'
import { ErrorBoundary } from 'react-error-boundary'
import { appWithFleur } from '../lib/fleur'
import { LysContext } from '@fleur/lys'

const fastclick = typeof window !== 'undefined' ? require('fastclick') : null
typeof window !== 'undefined' ? require('doubletouch-to-dblclick') : null

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    fastclick?.attach(document.body)
  }, [])

  return (
    <>
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

const ErrorFallback = () => {
  useEffect(() => {
    // setTimeout(() => window.location.reload(), 1000)
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

import '../lib/polyfill'

import App, { AppProps, AppContext } from 'next/app'
import { appWithTranslation } from 'next-i18next'
import { ThemeProvider } from 'styled-components'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { Restart } from '@styled-icons/remix-line'
import { GlobalStyle } from '../components/GlobalStyle'
import { lightTheme, theme } from '../utils/theme'
import { ErrorBoundary } from 'react-error-boundary'
import { useMedia } from '../utils/hooks'
import { narrow } from '../utils/responsive'
import { appWithFleur } from '../lib/fleur'

const fastclick = process.browser ? require('fastclick') : null

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isNarrow = useMedia(`(max-width: ${narrow})`, false)

  useEffect(() => {
    fastclick?.attach(document.body)
  }, [])

  return (
    <>
      <GlobalStyle isNarrow={isNarrow} />

      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  )
}

MyApp.getInitialProps = async (context: AppContext) => {
  // calls page's `getInitialProps` and fills `appProps.pageProps`
  const appProps = await App.getInitialProps(context)

  return { ...appProps }
}

const ErrorFallback = () => {
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

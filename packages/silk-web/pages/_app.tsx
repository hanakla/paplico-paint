import '../lib/polyfill'

import App, { AppProps } from 'next/app'
import {appWithTranslation} from 'next-i18next'
import { ThemeProvider } from 'styled-components'
import { GlobalStyle } from '../components/GlobalStyle'
import { appWithFleurContext, FleurAppContext } from '../lib/fleur'
import { theme } from '../utils/theme'
import { useEffect } from 'react'

const fastclick = process.browser ? require('fastclick') : null

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    fastclick?.attach(document.body)
  }, [])

  return (
    <>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <Component {...pageProps} />
      </ThemeProvider>
    </>
  )
}

MyApp.getInitialProps = async (appContext: FleurAppContext) => {
  // calls page's `getInitialProps` and fills `appProps.pageProps`
  const appProps = await App.getInitialProps(appContext)

  return { ...appProps }
}

export default appWithTranslation(appWithFleurContext(MyApp))

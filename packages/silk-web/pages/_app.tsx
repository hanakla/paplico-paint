import App, { AppProps } from 'next/app'
import { GlobalStyle } from '../components/GlobalStyle'
import { appWithFleurContext, FleurAppContext } from '../lib/fleur'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <GlobalStyle />
      <Component {...pageProps} />
    </>
  )
}

MyApp.getInitialProps = async (appContext: FleurAppContext) => {
  // calls page's `getInitialProps` and fills `appProps.pageProps`
  const appProps = await App.getInitialProps(appContext)

  return { ...appProps }
}

export default appWithFleurContext(MyApp)

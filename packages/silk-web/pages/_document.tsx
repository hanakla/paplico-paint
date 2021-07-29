import Document, { Head, Html, Main, NextScript } from 'next/document'

export default class AppDocument extends Document {
  public render() {
    return (
      <Html>
        <Head>
          <link rel="manifest" href="/manifest.json" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

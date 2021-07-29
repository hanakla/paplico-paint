import Document, { Head, Html, Main, NextScript } from 'next/document'
import { Silk } from 'silk-core'

export default class AppDocument extends Document {
  private engine: Silk

  componentDidMount() {
    this.engine = new Silk()
  }

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

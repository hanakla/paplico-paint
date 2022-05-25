import Head from 'next/head'
import { GlobalStyle } from '../components/GlobalStyle'
import styled from 'styled-components'

export default function IndexPage() {
  return (
    <Container>
      <Head>
        <title>Paplico Paint</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <GlobalStyle />

      <TopBar>
        <Tab>Paplico</Tab>
      </TopBar>
      <WebView nodeintegration src="http://localhost:3000" autosize />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-flow: column;
  width: 100%;
  height: 100%;
`

const WebView = styled('webview')`
  width: 100%;
  height: 100%;
  flex: 1;
`

const TopBar = styled.div`
  display: block;
  height: 32px;
  padding-left: 72px;
  color: #fff;
  background-color: #de455e;
  -webkit-app-region: drag;
`

const Tab = styled.div`
  display: inline-block;
  padding: 8px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 400;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`

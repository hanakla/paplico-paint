import { ThemeProvider } from 'styled-components'
import { PaintV3 } from '🙌/features/PaintV3'
import { CharcoalTheme, dark, light } from '@charcoal-ui/theme'
import { GlobalStyle } from '🙌/components/GlobalStyle'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import nextI18nextConfig from '../../next-i18next.config'

// const InfiniteCanvas: typeof import('ef-infinite-canvas').InfiniteCanvas = require('ef-infinite-canvas')

export default function V3Page() {
  return (
    <>
      <GlobalStyle />
      <PaintV3 />
    </>
  )
}

export const getStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(
        locale!,
        ['app', 'index-home'],
        nextI18nextConfig
      ))
      // Will be passed to the page component as props
    }
  }
}

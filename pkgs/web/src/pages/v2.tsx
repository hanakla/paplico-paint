import { ThemeProvider } from 'styled-components'
import { PaintV2 } from '🙌/features/PaintV2'
import { CharcoalTheme, dark, light } from '@charcoal-ui/theme'
import { GlobalStyle } from '🙌/components/GlobalStyle'
import { FleurContext } from '@fleur/react'
import { useMemo } from 'react'
import { createContext } from '🙌/domains'
import { LysContext } from '@fleur/lys'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { getStaticPropsWithFleur } from '🙌/lib/fleur'
import nextI18nextConfig from '../../next-i18next.config'

// const InfiniteCanvas: typeof import('ef-infinite-canvas').InfiniteCanvas = require('ef-infinite-canvas')

export default function V2Page() {
  const fleurContext = useMemo(() => createContext(), [])

  return (
    <FleurContext value={fleurContext}>
      <LysContext>
        <ThemeProvider theme={light}>
          <GlobalStyle />
          <PaintV2 />
        </ThemeProvider>
      </LysContext>
    </FleurContext>
  )
}

export const getStaticProps = getStaticPropsWithFleur(async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(
        locale!,
        ['app', 'index-home'],
        nextI18nextConfig
      )),
      // Will be passed to the page component as props
    },
  }
})

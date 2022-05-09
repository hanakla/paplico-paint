import type {} from '../utils/styled-theme'
import type {} from '../declarations'

import 'react-contexify/dist/ReactContexify.css'
import React, { memo, useEffect, useMemo } from 'react'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { createGlobalStyle, ThemeProvider } from 'styled-components'
import { useFleurContext, useStore } from '@fleur/react'
import { useMedia } from '🙌/utils/hooks'
import {
  darkWithCharcoal,
  lightWithCharcoal,
  ThemeType,
  tm,
} from '🙌/utils/theme'
import i18nConfig from '../../next-i18next.config'
import { narrow } from '🙌/utils/responsive'
import { getStaticPropsWithFleur } from '🙌/lib/fleur'
import { EditorOps, EditorStore } from '🙌/domains/EditorStable'
import { PaintPage } from '🙌/features/Paint'
import { HomeContent } from '🙌/features/Home'
import { shallowEquals } from '🙌/utils/object'

// Index.getInitialProps = async (ctx: FleurishNextPageContext) => {
//   // await Promise.all([
//   //   ctx.executeOperation(AppOps.asyncIncrement, (Math.random() * 1000) | 0),
//   //   ctx.executeOperation(AppOps.settleAccessDate),
//   // ])

//   // return {}
//   return {}
// }

declare module 'styled-components' {
  export interface DefaultTheme extends ThemeType {}
}

const DefaultStyle = createGlobalStyle`
  html {
    ${tm((o) => [o.bg.surface1])}
  }
`

const PageSwitch = memo(function PageSwitch() {
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, false)

  const { executeOperation } = useFleurContext()
  const { editorPage, currentTheme } = useStore((get) => ({
    editorPage: get(EditorStore).state.editorPage,
    currentTheme: get(EditorStore).state.currentTheme,
  }))

  useEffect(() => {
    executeOperation(EditorOps.restorePreferences)
    executeOperation(EditorOps.setEditorMode, isNarrowMedia ? 'sp' : 'pc')
  }, [])

  const theme = useMemo(
    () => (currentTheme === 'dark' ? darkWithCharcoal : lightWithCharcoal),
    [currentTheme]
  )

  return (
    <ThemeProvider theme={theme}>
      <DefaultStyle />
      <>{editorPage === 'home' ? <HomeContent /> : <PaintPage />}</>
    </ThemeProvider>
  )
})

export default function Index() {
  return <PageSwitch />
}

export const getStaticProps = getStaticPropsWithFleur(async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(
        locale!,
        ['app', 'index-home'],
        i18nConfig
      )),
      // Will be passed to the page component as props
    },
  }
})
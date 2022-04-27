import 'react-contexify/dist/ReactContexify.css'

import { memo, useEffect } from 'react'
import { createGlobalStyle } from 'styled-components'

import i18nConfig from '../../next-i18next.config'
import { EditorOps } from '🙌/domains/EditorStable'
import { getStaticPropsWithFleur } from '🙌/lib/fleur'
import { useFleur, useMedia } from '🙌/utils/hooks'
import { narrow } from '🙌/utils/responsive'
import { PaintPage } from '🙌/features/Paint'
import { tm } from '🙌/utils/theme'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'

export default memo(function AppPage() {
  const { execute } = useFleur()
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, false)

  useEffect(() => {
    execute(EditorOps.restorePreferences)
    execute(EditorOps.setEditorMode, isNarrowMedia ? 'sp' : 'pc')
  }, [])

  return (
    <>
      <DefaultStyle />
      <PaintPage />
    </>
  )
})

export const getStaticProps = getStaticPropsWithFleur(async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(
        locale!,
        ['app', 'index-home'],
        i18nConfig
      )),
    },
  }
})

const DefaultStyle = createGlobalStyle`
  html {
    ${tm((o) => [o.bg.surface1])}
  }
`

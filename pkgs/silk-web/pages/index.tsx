import type {} from '../utils/styled-theme'

import React, { MouseEvent, useEffect } from 'react'
import { useDropArea } from 'react-use'
import { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { loadImageFromBlob, selectFile, useFunk } from '@hanakla/arma'
import { SilkDOM, SilkSerializer, SilkHelper } from 'silk-core'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { DragDrop, File, Menu } from '@styled-icons/remix-line'
import {
  createGlobalStyle,
  css,
  ThemeProvider,
  useTheme,
} from 'styled-components'
import { useFleurContext, useStore } from '@fleur/react'
import { extname } from 'path'
import Head from 'next/head'
import { Sidebar } from '../components/Sidebar'
import { useMedia } from '../utils/hooks'
import { lightTheme, theme } from '../utils/theme'
import { rgba } from 'polished'
import { centering } from '../utils/mixins'
import i18nConfig from '../next-i18next.config'
import { mediaNarrow, narrow } from '../utils/responsive'
import { getStaticPropsWithFleur } from '../lib/fleur'
import { editorOps, EditorSelector, EditorStore } from '../domains/EditorStable'
import { PaintPage } from '../features/Paint'

// Index.getInitialProps = async (ctx: FleurishNextPageContext) => {
//   // await Promise.all([
//   //   ctx.executeOperation(AppOps.asyncIncrement, (Math.random() * 1000) | 0),
//   //   ctx.executeOperation(AppOps.settleAccessDate),
//   // ])

//   // return {}
//   return {}
// }

const HomeContent = () => {
  const theme = useTheme()

  const { executeOperation } = useFleurContext()
  const { currentTheme } = useStore((get) => ({
    currentDocument: EditorSelector.currentDocument(get),
    activeLayer: EditorSelector.activeLayer(get),
    currentTool: get(EditorStore).state.currentTool,
    currentTheme: get(EditorStore).state.currentTheme,
    renderSetting: get(EditorStore).state.renderSetting,
  }))

  const handleClickItem = useFunk(
    async ({ currentTarget: { dataset } }: MouseEvent<HTMLDivElement>) => {
      const width = parseInt(dataset.width!)
      const height = parseInt(dataset.height!)

      const doc = SilkDOM.Document.create({ width, height })
      const layer = SilkDOM.RasterLayer.create({ width, height })
      doc.addLayer(layer)
      doc.activeLayerId = layer.uid

      executeOperation(editorOps.setDocument, doc)
      executeOperation(editorOps.setEditorPage, 'app')
    }
  )

  const handleFileSelected = useFunk(async (file: File) => {
    const ext = extname(file.name)

    if (ext === '.silk') {
      const doc = SilkSerializer.importDocument(
        new Uint8Array(await file.arrayBuffer())
      )

      executeOperation(editorOps.setDocument, doc)
      executeOperation(editorOps.setEditorPage, 'app')
    } else if (/^image\//.test(file.type)) {
      const { image, url } = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)

      URL.revokeObjectURL(url)

      const doc = SilkDOM.Document.create({
        width: layer.width,
        height: layer.height,
      })
      doc.addLayer(layer)

      executeOperation(editorOps.setDocument, doc)
      executeOperation(editorOps.setEditorPage, 'app')
    }
  })

  const handleClickDropArea = useFunk(async () => {
    const [file] = await selectFile({
      extensions: ['.silk', '.png', '.jpg'],
      multiple: false,
    })
    if (!file) return

    handleFileSelected(file)
  })

  const handleClickDarkTheme = useFunk(() =>
    executeOperation(editorOps.setTheme, 'dark')
  )
  const handleClickLightTheme = useFunk(() =>
    executeOperation(editorOps.setTheme, 'light')
  )

  const [bindDrop, dropState] = useDropArea({
    onFiles: ([file]) => {
      handleFileSelected(file)
    },
  })

  return (
    <div
      css={css`
        display: flex;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: ${({ theme }) => theme.colors.black50};
        color: ${({ theme }) => theme.text.white};
      `}
    >
      <Sidebar
        css={`
          width: 200px;

          ${mediaNarrow`
            display: none;
          `}
        `}
      />

      <div
        css={`
          flex: 1;
          padding: 10vh 64px;

          ${mediaNarrow`
            overflow: auto;

            padding: 32px;
          `}
        `}
      >
        <div>
          <h1
            css={`
              margin-bottom: 0.8em;
              font-size: 48px;

              ${mediaNarrow`
                font-size: 32px;
              `}
            `}
          >
            あたらしく描く
          </h1>

          <div
            css={`
              display: grid;
              gap: 16px;
              grid-template-columns: repeat(4, minmax(0px, 1fr));

              ${mediaNarrow`
                grid-template-columns: repeat(2, minmax(0px, 1fr));
              `}
            `}
          >
            {[
              { name: '縦長', size: [1080, 1920] },
              { name: '横長', size: [1920, 1080] },

              { name: 'A4(縦) 300dpi', size: [2480, 3508] },
              { name: 'A4(横) 300dpi', size: [3508, 2480] },
            ].map((preset, idx) => (
              <div
                key={idx}
                css={css`
                  padding: 16px;
                  text-align: center;
                  border-radius: 8px;
                  background-color: ${({ theme }) => theme.colors.whiteFade10};
                  cursor: pointer;

                  &:hover {
                    background-color: ${({ theme }) =>
                      theme.colors.whiteFade20};
                  }
                `}
                onClick={handleClickItem}
                tabIndex={-1}
                data-width={preset.size[0]}
                data-height={preset.size[1]}
              >
                <File
                  css={`
                    width: 64px;
                  `}
                />
                <div
                  css={`
                    margin: 8px 0 8px;
                    font-size: 16px;
                    font-weight: bold;
                  `}
                >
                  {preset.name}
                </div>
                <div>
                  {preset.size[0]} × {preset.size[1]} px
                </div>
              </div>
            ))}
          </div>

          <h1
            css={`
              margin-top: 1.3em;
              margin-bottom: 0.8em;
              font-size: 48px;

              ${mediaNarrow`
                font-size: 32px;
              `}
            `}
          >
            ファイルをひらく
          </h1>

          <div
            css={css`
              ${centering()}
              flex-flow:column;
              padding: 48px 32px;
              font-size: 24px;
              background-color: ${({ theme }) => theme.colors.whiteFade10};
              border-radius: 8px;
            `}
            style={{
              ...(dropState.over
                ? { backgroundColor: theme.colors.whiteFade20 }
                : {}),
            }}
            onClick={handleClickDropArea}
            {...bindDrop}
          >
            <DragDrop
              css={`
                width: 32px;
                margin-right: 16px;
                vertical-align: bottom;
              `}
            />
            ファイルをドロップしてひらく
          </div>

          <div
            css={css`
              display: flex;
              margin-top: 16px;
              padding: 16px 0 0;
              border-top: ${({ theme }) =>
                `1px solid ${rgba(theme.colors.white50, 0.2)}`};
            `}
          >
            <div
              css={css`
                ${centering()}
                gap: 4px;
              `}
            >
              <span
                css={`
                  padding: 4px;
                  border-radius: 64px;
                `}
                style={{
                  color:
                    currentTheme === 'dark'
                      ? theme.exactColors.black40
                      : undefined,
                  backgroundColor:
                    currentTheme === 'dark'
                      ? theme.exactColors.white40
                      : undefined,
                }}
                onClick={handleClickDarkTheme}
              >
                <Moon
                  css={`
                    width: 20px;
                  `}
                />
              </span>
              <span
                css={`
                  padding: 4px;
                  border-radius: 64px;
                `}
                style={{
                  color:
                    currentTheme === 'light'
                      ? theme.exactColors.white40
                      : undefined,
                  backgroundColor:
                    currentTheme === 'light'
                      ? theme.exactColors.black40
                      : undefined,
                }}
                onClick={handleClickLightTheme}
              >
                <Sun
                  css={`
                    width: 20px;
                  `}
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const DefaultStyle = createGlobalStyle`
  html {
    background-color: #bebebe;
  }
`

const PageSwitch = () => {
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, false)

  const { executeOperation } = useFleurContext()
  const { editorPage, currentTheme } = useStore((get) => ({
    editorPage: get(EditorStore).state.editorPage,
    currentTheme: get(EditorStore).state.currentTheme,
  }))

  useEffect(() => {
    executeOperation(editorOps.restorePreferences)
    executeOperation(editorOps.setEditorMode, isNarrowMedia ? 'sp' : 'pc')
  }, [])

  return (
    <ThemeProvider theme={currentTheme === 'dark' ? theme : lightTheme}>
      <DefaultStyle />
      <Head>
        <meta
          name="viewport"
          content="viewport-fit=cover, width=device-width, initial-scale=1"
        />
      </Head>
      <>{editorPage === 'home' ? <HomeContent /> : <PaintPage />}</>
    </ThemeProvider>
  )
}

export default function Index() {
  return <PageSwitch />
}

export const getStaticProps = getStaticPropsWithFleur(async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale!, ['app'], i18nConfig)),
      // Will be passed to the page component as props
    },
  }
})

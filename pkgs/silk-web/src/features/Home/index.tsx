import { MouseEvent } from 'react'
import styled, { css, useTheme } from 'styled-components'
import { SilkDOM, SilkHelper, SilkSerializer } from 'silk-core'
import { useFleurContext, useStore } from '@fleur/react'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { DragDrop, File } from '@styled-icons/remix-line'
import { loadImageFromBlob, selectFile, useFunk } from '@hanakla/arma'
import { extname } from 'path'
import { useDropArea } from 'react-use'
import { rgba } from 'polished'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { Sidebar } from '🙌/components/Sidebar'
import { mediaNarrow } from '🙌/utils/responsive'
import { centering } from '🙌/utils/mixins'
import { tm } from '🙌/utils/theme'
import { useTranslation } from 'next-i18next'

export const HomeContent = () => {
  const theme = useTheme()
  const { t } = useTranslation()

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

      executeOperation(EditorOps.setDocument, doc)
      executeOperation(EditorOps.setEditorPage, 'app')
    }
  )

  const handleFileSelected = useFunk(async (file: File) => {
    const ext = extname(file.name)

    if (ext === '.silk') {
      const doc = SilkSerializer.importDocument(
        new Uint8Array(await file.arrayBuffer())
      )

      executeOperation(EditorOps.setDocument, doc)
      executeOperation(EditorOps.createSession, doc)
      executeOperation(EditorOps.setEditorPage, 'app')
    } else if (/^image\//.test(file.type)) {
      const { image, url } = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)

      URL.revokeObjectURL(url)

      const doc = SilkDOM.Document.create({
        width: layer.width,
        height: layer.height,
      })
      doc.addLayer(layer)

      executeOperation(EditorOps.setDocument, doc)
      executeOperation(EditorOps.createSession, doc)
      executeOperation(EditorOps.setEditorPage, 'app')
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
    executeOperation(EditorOps.setTheme, 'dark')
  )
  const handleClickLightTheme = useFunk(() =>
    executeOperation(EditorOps.setTheme, 'light')
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
          <Heading>{t('createNew')}</Heading>

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

          <Heading
            css={`
              margin-top: 1.3em;
            `}
          >
            {t('openFile')}
          </Heading>

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

          <section>
            <Heading
              css={`
                margin-top: 1.3em;
              `}
            >
              {t('savedItems')}
            </Heading>
          </section>

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

const Heading = styled.h1`
  margin-bottom: 0.8em;
  ${tm((o) => [o.typography(32)])}

  ${mediaNarrow`
    ${tm((o) => [o.typography(20)])}
  `}
`

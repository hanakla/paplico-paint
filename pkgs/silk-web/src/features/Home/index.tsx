import { MouseEvent, useState } from 'react'
import styled, { css, useTheme } from 'styled-components'
import { SilkDOM, SilkHelper, SilkSerializer } from 'silk-core'
import { useFleurContext, useStore } from '@fleur/react'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { DragDrop, File } from '@styled-icons/remix-line'
import { cssurl, loadImageFromBlob, selectFile, useFunk } from '@hanakla/arma'
import { extname } from 'path'
import { useDropArea, useMount } from 'react-use'
import { rgba } from 'polished'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { Sidebar } from '🙌/components/Sidebar'
import { media } from '🙌/utils/responsive'
import { centering } from '🙌/utils/mixins'
import { ThemeProp, tm } from '🙌/utils/theme'
import { useTranslation } from 'next-i18next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ja'
import { useRouter } from 'next/router'
import { useFleur } from '🙌/utils/hooks'
import { Button } from '🙌/components/Button'
import {
  ContextMenuParam,
  useContextMenu,
  ContextMenu,
  ContextMenuItem,
} from '🙌/components/ContextMenu'
import { NotifyOps } from '../../domains/Notify'
dayjs.extend(relativeTime)

export const HomeContent = () => {
  const { t } = useTranslation('index-home')
  const { locale, ...router } = useRouter()
  const theme = useTheme()

  const contextMenu = useContextMenu()
  const [displayItems, setDisplayItems] = useState(12)

  const { execute, getStore } = useFleur()
  const { savedItems, currentTheme } = useStore((get) => ({
    savedItems: EditorSelector.savedItems(get),
    currentTheme: get(EditorStore).state.currentTheme,
  }))

  const loadingNotification = (fn: () => void) => {
    let timerId: number

    execute(NotifyOps.create, {
      area: 'loadingLock',
      messageKey: 'home.opening',
      timeout: 0,
      lock: true,
    })

    timerId = window.setInterval(() => {
      console.log(getStore(EditorStore).state.editorPage)
      if (getStore(EditorStore).state.editorPage !== 'app') return

      execute(NotifyOps.create, {
        area: 'loadingLock',
        messageKey: 'home.opened',
        timeout: 0,
        lock: false,
      })

      window.clearInterval(timerId)
    })

    setTimeout(() => fn(), 100)
  }

  const handleClickItem = useFunk(
    async ({ currentTarget: { dataset } }: MouseEvent<HTMLDivElement>) => {
      const width = parseInt(dataset.width!)
      const height = parseInt(dataset.height!)

      const doc = SilkDOM.Document.create({ width, height })
      const layer = SilkDOM.RasterLayer.create({ width, height })
      const bgLayer = SilkDOM.VectorLayer.create({})
      bgLayer.objects.push(
        SilkDOM.VectorObject.create({
          x: 0,
          y: 0,
          path: SilkDOM.Path.create({
            points: [
              { x: 0, y: 0, in: null, out: null },
              { x: width, y: 0, in: null, out: null },
              { x: width, y: height, in: null, out: null },
              { x: 0, y: height, in: null, out: null },
            ],
            closed: true,
          }),
          brush: null,
          fill: {
            type: 'fill',
            color: { r: 1, g: 1, b: 1 },
            opacity: 1,
          },
        })
      )
      doc.addLayer(bgLayer)
      doc.addLayer(layer, { aboveLayerId: bgLayer.uid })
      doc.activeLayerPath = [layer.uid]

      loadingNotification(() => {
        execute(EditorOps.createSession, doc)
        execute(EditorOps.setEditorPage, 'app')
      })
    }
  )

  const handleFileSelected = useFunk(async (file: File) => {
    const ext = extname(file.name)

    if (ext === '.silk') {
      execute(EditorOps.loadDocumentFromFile, file)
    } else if (/^image\//.test(file.type)) {
      const { image, url } = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)

      URL.revokeObjectURL(url)

      const doc = SilkDOM.Document.create({
        width: layer.width,
        height: layer.height,
      })
      doc.addLayer(layer)

      loadingNotification(() => {
        execute(EditorOps.createSession, doc)
        execute(EditorOps.setEditorPage, 'app')
      })
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
    execute(EditorOps.setTheme, 'dark')
  )
  const handleClickLightTheme = useFunk(() =>
    execute(EditorOps.setTheme, 'light')
  )

  const handleClickSavedItem = useFunk(
    ({ currentTarget }: MouseEvent<HTMLLIElement>) => {
      loadingNotification(() => {
        execute(
          EditorOps.loadDocumentFromIdb,
          currentTarget.dataset.documentUid!
        )
        execute(EditorOps.setEditorPage, 'app')
      })
    }
  )

  const handleClickMoreSavedItems = useFunk(() => {
    setDisplayItems((s) => s + 6)
  })

  const handleItemContextMenu = useFunk((e: MouseEvent<HTMLLIElement>) => {
    contextMenu.show(e, {
      props: { documentUid: e.currentTarget.dataset.documentUid },
    })
  })

  const handleClickRemoveDocument = useFunk(
    (e: ContextMenuParam<{ documentUid: string }>) => {
      if (confirm(t('removeDocumentConfirm'))) {
        execute(EditorOps.removeSavedDocment, e.props!.documentUid)
      }
    }
  )

  const [bindDrop, dropState] = useDropArea({
    onFiles: ([file]) => {
      handleFileSelected(file)
    },
  })

  useMount(() => {
    execute(EditorOps.fetchSavedItems)
  })

  return (
    <div
      css={css`
        display: flex;
        width: 100%;
        height: 100%;
        overflow: hidden;
        /* background-color: ${({ theme }) => theme.colors.black50}; */
        color: ${({ theme }) => theme.text.white};
      `}
    >
      <Sidebar
        css={`
          width: 200px;

          ${media.narrow`
            display: none;
          `}
        `}
      />

      <div
        css={`
          flex: 1;
          padding: 10vh 64px;
          overflow: auto;

          ${media.narrow`
            padding: 32px;
          `}
        `}
      >
        <div>
          <section>
            <Heading>{t('createNew')}</Heading>

            <div
              css={`
                display: grid;
                gap: 16px;
                grid-template-columns: repeat(4, minmax(0px, 1fr));

                ${media.narrow`
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
                    background-color: ${({ theme }) =>
                      theme.colors.whiteFade10};
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
          </section>

          <section
            css={`
              margin-top: 64px;
            `}
          >
            <Heading>{t('openFile')}</Heading>

            <div
              css={css`
                ${centering()}
                flex-flow:column;
                padding: 48px 32px;
                font-size: 24px;
                background-color: ${({ theme }) => theme.colors.whiteFade20};
                border-radius: 8px;
                cursor: pointer;

                &:hover {
                  background-color: ${({ theme }) => theme.colors.whiteFade30};
                }
              `}
              style={{
                ...(dropState.over
                  ? { backgroundColor: theme.colors.whiteFade30 }
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
          </section>

          <section
            css={`
              margin-top: 64px;
            `}
          >
            <Heading>{t('savedItems')}</Heading>
            <ul
              css={`
                display: grid;
                flex-wrap: nowrap;
                gap: 8px;
                margin: 0 -8px;
                overflow: auto;
                grid-template-columns: repeat(6, 1fr);

                ${media.narrow`
                  display: grid;
                  gap: 24px 8px;
                  grid-template-columns: repeat(2, 1fr);
                  overflow: none;
                `}
              `}
            >
              {savedItems.slice(0, displayItems).map((item) => (
                <li
                  key={item.uid}
                  css={css`
                    /* width: 128px; */
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;

                    &:hover {
                      background-color: ${({ theme }) =>
                        theme.colors.whiteFade10};
                    }

                    ${media.narrow`
                      width: 100%;
                    `}
                  `}
                  data-document-uid={item.uid}
                  onClick={handleClickSavedItem}
                  onContextMenu={handleItemContextMenu}
                >
                  <div
                    role="img"
                    css={`
                      width: 100%;
                      background-position: 80% 0;
                      background-size: cover;
                      border-radius: 4px;
                      background-color: ${({ theme }: ThemeProp) =>
                        theme.color.surface9};

                      &::before {
                        content: '';
                        display: block;
                        padding-top: 100%;
                      }
                    `}
                    style={{ backgroundImage: cssurl(item.thumbnailUrl) }}
                  />

                  <h2
                    css={`
                      margin: 8px 0 4px;
                      ${tm((o) => [o.typography(14)])}
                    `}
                  >
                    {!item.title ? <span>{t('untitled')}</span> : item.title}
                  </h2>
                  <time
                    css={`
                      display: block;
                      ${tm((o) => [o.font.text2])}
                    `}
                  >
                    {dayjs(item.updatedAt).locale(locale!).fromNow()}
                  </time>
                </li>
              ))}
            </ul>

            {savedItems.length > displayItems && (
              <div
                css={`
                  ${centering()}
                  margin: 16px 0 32px;
                  text-align: center;
                `}
              >
                <Button
                  css={`
                    ${tm((o) => [o.typography(14)])}
                    text-align: center;
                    cursor: pointer;
                  `}
                  kind="normal"
                  onClick={handleClickMoreSavedItems}
                >
                  もっと見る
                </Button>
              </div>
            )}
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

        <ContextMenu id={contextMenu.id}>
          <ContextMenuItem onClick={handleClickRemoveDocument}>
            <span
              css={`
                ${tm((o) => [o.font.assertive.bold])}
              `}
            >
              ドキュメントを削除
            </span>
          </ContextMenuItem>
        </ContextMenu>
      </div>
    </div>
  )
}

const Heading = styled.h1`
  margin-bottom: 0.8em;
  ${tm((o) => [o.typography(32).bold])}

  ${media.narrow`
    margin-top: 32px;
    ${tm((o) => [o.typography(20).bold])}
  `}
`
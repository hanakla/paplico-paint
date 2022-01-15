import type {} from '../utils/styled-theme'

import React, {
  ChangeEvent,
  MouseEvent,
  TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  useClickAway,
  useDrop,
  useDropArea,
  useToggle,
  useUpdate,
} from 'react-use'
import { GetStaticProps } from 'next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import {
  letDownload,
  loadImageFromBlob,
  useAsyncEffect,
  selectFile,
  match,
} from '@hanakla/arma'
import { EngineContextProvider } from '../lib/EngineContext'
import { Silk, SilkEntity, SilkSerializer, SilkHelper } from 'silk-core'
import { useSpring, animated } from 'react-spring'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { DragDrop, File, Menu } from '@styled-icons/remix-line'
import { LysContext, useLysSlice, useLysSliceRoot } from '@fleur/lys'
import { useGesture } from 'react-use-gesture'
import {
  createGlobalStyle,
  css,
  ThemeProvider,
  useTheme,
} from 'styled-components'
import { extname } from 'path'
import { DebugView } from '../containers/DebugView'
import { EditorSlice } from '../domains/Editor'
import { useTap } from '../hooks/useTap'
import { useTranslation } from 'next-i18next'
import Head from 'next/head'
import { useGlobalMouseTrap } from '../hooks/useMouseTrap'
import { Sidebar } from '../components/Sidebar'
import { FilterView } from '../containers/FilterView'
import { useMedia } from '../utils/hooks'
import { lightTheme, theme } from '../utils/theme'
import { rgba } from 'polished'
import { Button } from '../components/Button'
import { centering } from '../utils/mixins'
import { LayerView } from '../containers/LayerView'
import { MainActions } from '../containers/MainActions/MainActions'
import { ControlsOverlay } from '../containers/ControlsOverlay'
import i18nConfig from '../next-i18next.config'
import { mediaNarrow, narrow } from '../utils/responsive'
import { getStaticPropsWithFleur } from '../lib/fleur'
import useMeasure from 'use-measure'

function IndexContent({}) {
  const { t } = useTranslation('app')

  const [editorState, editorActions] = useLysSlice(EditorSlice)
  const { currentDocument, activeLayer } = editorState
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, false)

  const engine = useRef<Silk | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editAreaRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)

  const editorBound = useMeasure(editAreaRef)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const rerender = useUpdate()
  const [sidebarOpened, sidebarToggle] = useToggle(!isNarrowMedia)
  const [scale, setScale] = useState(0.5)
  const [rotate, setRotate] = useState(0)
  // const sidebarStyles = useSpring({
  //   width: isNarrowMedia === false || sidebarOpened ? 200 : 32,
  // })

  const handleOnDrop = useCallback(
    async (files: File[]) => {
      if (!currentDocument) return

      let lastLayerId: string | null = activeLayer?.id ?? null

      for (const file of files) {
        const { image } = await loadImageFromBlob(file)
        const layer = await SilkHelper.imageToLayer(image)

        editorActions.updateDocument((document) => {
          document.addLayer(layer, {
            aboveLayerId: lastLayerId,
          })
        })

        lastLayerId = layer.id
      }
    },
    [currentDocument, activeLayer]
  )

  const handleTapEditArea = useCallback(
    ({ touches }: TouchEvent<HTMLDivElement>) => {
      if (touches.length === 2) console.log('undo')
      if (touches.length === 3) console.log('redo')
    },
    []
  )

  const handleChangeDisableFilters = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      editorActions.setRenderSetting({
        disableAllFilters: currentTarget.checked,
      })
    },
    []
  )

  const handleClickExport = useCallback(() => {
    if (!currentDocument) return

    const bin = SilkSerializer.exportDocument(
      currentDocument as SilkEntity.Document
    )!
    const blob = new Blob([bin], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    letDownload(url, 'test.silk')

    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }, [currentDocument])

  const handleClickExportAs = useCallback(
    async (e: MouseEvent<HTMLDivElement>) => {
      const { currentTarget } = e
      e.stopPropagation()

      if (!currentDocument || !engine.current) return

      const type = currentTarget.dataset.type!
      const mime = match(type)
        .when('png', 'image/png')
        .when('jpeg', 'image/jpeg')
        ._(new Error(`Unexpected type ${type}`))

      const blob = await (await engine.current.render())!.export(mime, 1.0)
      const url = URL.createObjectURL(blob)
      letDownload(
        url,
        !currentDocument.title
          ? `${t('untitled')}.${type}`
          : `${currentDocument.title}.${type}`
      )

      setTimeout(() => URL.revokeObjectURL(url), 10000)
    },
    [currentDocument, engine]
  )

  const handleClickDarkTheme = useCallback(
    () => editorActions.setTheme('dark'),
    []
  )

  const handleClickLightTheme = useCallback(
    () => editorActions.setTheme('light'),
    []
  )

  const dragState = useDrop({ onFiles: handleOnDrop })
  const tapBind = useTap(handleTapEditArea)

  useGlobalMouseTrap(
    [
      { key: 'v', handler: () => editorActions.setTool('cursor') },
      { key: 'b', handler: () => editorActions.setTool('draw') },
      { key: 'e', handler: () => editorActions.setTool('erase') },
      { key: 'p', handler: () => editorActions.setTool('shape-pen') },
      {
        key: 'tab',
        handler: (e) => {
          e.preventDefault()
          sidebarToggle()
        },
      },
    ],
    []
  )

  useGesture(
    {
      onPinch: ({ delta: [d, r] }) => {
        setScale((scale) => Math.max(0.1, scale + d / 400))
        // setRotate(rotate => rotate + r)
      },
      // onDrag: ({ delta: [deltaX, deltaY], event }) => {
      //   // if (!event.to)
      //   // console.log(event.touches)
      //   setPosition(({ x, y }) => ({ x: x + deltaX, y: y + deltaY }))
      // },
    },
    { domTarget: editAreaRef, eventOptions: { passive: false } }
  )

  useClickAway(sidebarRef, () => {
    if (!isNarrowMedia) return
    sidebarToggle(false)
  })

  useAsyncEffect(async () => {
    ;(window as any).engine = engine.current = await Silk.create({
      canvas: canvasRef.current!,
    })
    editorActions.setEngine(engine.current)

    if (
      process.env.NODE_ENV === 'development' &&
      engine.current.currentDocument == null
    ) {
      const document = SilkEntity.Document.create({ width: 1000, height: 1000 })
      await engine.current.setDocument(document)

      const layer = SilkEntity.RasterLayer.create({ width: 1000, height: 1000 })
      const vector = SilkEntity.VectorLayer.create({
        width: 1000,
        height: 1000,
      })
      const text = SilkEntity.TextLayer.create({
        width: 1000,
        height: 1000,
      })
      const filter = SilkEntity.FilterLayer.create({})

      vector.filters.push(
        SilkEntity.Filter.create({
          filterId: '@silk-core/gauss-blur',
          settings: engine.current.getFilterInstance('@silk-core/gauss-blur')!
            .initialConfig,
        }),
        SilkEntity.Filter.create({
          filterId: '@silk-core/chromatic-aberration',
          settings: engine.current.getFilterInstance(
            '@silk-core/chromatic-aberration'
          )!.initialConfig,
        })
      )

      document.layers.push(layer)
      document.layers.push(vector)
      document.layers.push(text)
      document.layers.push(filter)
      editorActions.setActiveLayer(vector.id)

      engine.current.on('rerender', rerender)
      engine.current.rerender()

      editorActions.setFill({
        type: 'linear-gradient',
        colorPoints: [
          { color: { r: 0, g: 255, b: 255, a: 1 }, position: 0 },
          { color: { r: 128, g: 255, b: 200, a: 1 }, position: 1 },
        ],
        start: { x: -100, y: -100 },
        end: { x: 100, y: 100 },
        opacity: 1,
      })
    }

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })

    // window.addEventListener('mousewheel', e => {
    //   // e.preventDefault()
    //   e.stopPropagation()
    // }, {passive: false})
    rerender()

    return () => {}
  }, [])

  useEffect(() => {
    const handleCanvasWheel = (e: WheelEvent) => {
      setPosition(({ x, y }) => ({
        x: x - e.deltaX * 0.5,
        y: y - e.deltaY * 0.5,
      }))
      e.preventDefault()
    }

    editAreaRef.current?.addEventListener('wheel', handleCanvasWheel, {
      passive: false,
    })
    return () =>
      editAreaRef.current?.removeEventListener('wheel', handleCanvasWheel)
  }, [])

  useEffect(() => {
    if (!engine.current) return
    engine.current.canvasScale = scale
  }, [scale, engine.current])

  return (
    <EngineContextProvider value={engine.current}>
      <TouchActionStyle />

      <div
        ref={rootRef}
        css={css`
          position: relative;
          display: flex;
          flex-flow: row;
          width: 100%;
          height: 100%;
          background-color: ${({ theme }) => theme.surface.default};
          color: ${({ theme }) => theme.text.white};
        `}
        tabIndex={-1}
      >
        <>
          {!isNarrowMedia && (
            <div ref={sidebarRef}>
              <Sidebar
                style={{
                  width: sidebarOpened ? 200 : 32,
                }}
              >
                <div
                  css={`
                    display: flex;
                    flex-flow: column;
                    flex: 1;
                    width: 200px;
                    height: 100%;
                    padding-bottom: env(safe-area-inset-bottom);
                  `}
                >
                  <LayerView />

                  <FilterView />

                  <div css="display: flex; padding: 8px; margin-top: auto;">
                    <div
                      css="margin-right: auto; cursor: default;"
                      onClick={sidebarToggle}
                    >
                      <Menu
                        css={`
                          width: 16px;
                        `}
                      />
                    </div>
                  </div>
                </div>
              </Sidebar>
            </div>
          )}
        </>

        <div
          ref={editAreaRef}
          css={css`
            position: relative;
            display: flex;
            flex: 1;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background-color: ${({ theme }) => theme.surface.canvas};
          `}
          style={{
            // prettier-ignore
            cursor:
              editorState.currentTool === 'cursor' ? 'default' :
              editorState.currentTool === 'draw' ? 'url(cursors/pencil.svg), auto' :
              editorState.currentTool === 'erase' ? 'url(cursors/eraser.svg), auto' :
              editorState.currentTool === 'shape-pen' ? 'url(cursors/pencil-line.svg), auto':
              'default',
          }}
        >
          <div
            css={css`
              position: fixed;
              top: 0;
              left: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
              z-index: 1;
              background-color: rgba(0, 0, 0, 0.5);
              color: ${({ theme }) => theme.exactColors.white40};
              pointer-events: none;
            `}
            style={{
              ...(dragState.over ? { opacity: 1 } : { opacity: 0 }),
            }}
          >
            ドロップして画像を追加
          </div>
          <div
            css="position: absolute;"
            style={{
              transform: `scale(${scale}) rotate(${rotate}deg) translate(${position.x}px, ${position.y}px)`,
            }}
          >
            <canvas
              css={`
                background-color: white;
                box-shadow: 0 0 16px rgba(0, 0, 0, 0.1);
              `}
              ref={canvasRef}
            />
          </div>

          <svg
            css={`
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              pointer-events: none;
            `}
            viewBox={`0 0 ${editorBound.width} ${editorBound.height}`}
            width={editorBound.width}
            height={editorBound.height}
          >
            {/* <g
              style={{
                transform: `scale(${scale}) rotate(${rotate}deg) translate(${
                  position.x + editorBound.width / 2
                }px, ${position.y + editorBound.height / 2}px)`,
              }}
            > */}
            {/* <div
            css={`
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
            `}
          > */}
            <ControlsOverlay
              css={`
                position: absolute;
                top: 0;
                left: 0;
                pointer-events: none;
              `}
              // viewBox={`0 0 ${editorBound.width} ${editorBound.height}`}
              // width={editorBound.width}
              // height={editorBound.height}
              editorBound={editorBound}
              rotate={rotate}
              position={position}
              scale={scale}
            />
            {/* </g> */}
          </svg>
          {/* </div> */}
          <div
            css={`
              position: absolute;
              left: 50%;
              bottom: 16px;
              transform: translateX(-50%);
            `}
          >
            <MainActions />
          </div>

          <DebugView
            css={`
              position: absolute;
              top: 0;
              right: 0;
            `}
          />
        </div>

        <>
          {!isNarrowMedia && (
            <Sidebar
              style={{
                width: sidebarOpened ? 200 : 32,
              }}
            >
              <div
                css={`
                  display: flex;
                  flex-flow: column;
                  flex: 1;
                  width: 200px;
                `}
              >
                <div
                  css={`
                    padding: 4px 8px;
                  `}
                >
                  {t('colorHistory')}
                </div>
                <div
                  css={`
                    padding: 4px 8px;
                  `}
                >
                  {t('referenceColor')}
                </div>
                <div
                  css={`
                    padding: 4px 8px;
                  `}
                >
                  <label>
                    <input
                      css="margin-right: 4px"
                      type="checkbox"
                      checked={editorState.renderSetting.disableAllFilters}
                      onChange={handleChangeDisableFilters}
                    />
                    作業中のフィルター効果をオフ
                  </label>
                </div>

                <div
                  css={`
                    display: flex;
                    padding: 8px;
                    margin-top: auto;
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
                          editorState.currentTheme === 'dark'
                            ? theme.exactColors.black40
                            : undefined,
                        backgroundColor:
                          editorState.currentTheme === 'dark'
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
                          editorState.currentTheme === 'light'
                            ? theme.exactColors.white40
                            : undefined,
                        backgroundColor:
                          editorState.currentTheme === 'light'
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

                  <div
                    css={`
                      margin-left: auto;
                    `}
                  >
                    <Button
                      css={`
                        position: relative;
                      `}
                      kind="primary"
                      outline
                      onClick={handleClickExport}
                      popup={
                        <div
                          css={css`
                            background-color: ${({ theme }) =>
                              theme.exactColors.white50};

                            & > div {
                              padding: 8px;

                              &:hover {
                                background-color: ${({ theme }) =>
                                  theme.exactColors.blueFade40};
                              }
                            }
                          `}
                        >
                          <div onClick={handleClickExportAs} data-type="png">
                            PNG(透過)で書き出し
                          </div>
                          <div onClick={handleClickExportAs} data-type="png">
                            レイヤー別PNGで書き出し
                          </div>
                          <div onClick={handleClickExportAs} data-type="jpeg">
                            JPEGで保存
                          </div>
                        </div>
                      }
                    >
                      {t('export')}
                    </Button>
                  </div>
                </div>
              </div>
            </Sidebar>
          )}
        </>
      </div>
    </EngineContextProvider>
  )
}

// Index.getInitialProps = async (ctx: FleurishNextPageContext) => {
//   // await Promise.all([
//   //   ctx.executeOperation(AppOps.asyncIncrement, (Math.random() * 1000) | 0),
//   //   ctx.executeOperation(AppOps.settleAccessDate),
//   // ])

//   // return {}
//   return {}
// }

const TouchActionStyle = createGlobalStyle`
  html, body { touch-action: none; }
`

const HomeContent = () => {
  const theme = useTheme()

  const [editorState, editorActions] = useLysSlice(EditorSlice)

  const handleClickItem = useCallback(
    async ({ currentTarget: { dataset } }: MouseEvent<HTMLDivElement>) => {
      const width = parseInt(dataset.width!)
      const height = parseInt(dataset.height!)

      const doc = SilkEntity.Document.create({ width, height })
      const layer = SilkEntity.RasterLayer.create({ width, height })
      doc.addLayer(layer)
      doc.activeLayerId = layer.id

      await editorActions.setDocument(doc)
      editorActions.setEditorPage('app')
    },
    []
  )

  const handleFileSelected = useCallback(async (file: File) => {
    const ext = extname(file.name)

    if (ext === '.silk') {
      const doc = SilkSerializer.importDocument(
        new Uint8Array(await file.arrayBuffer())
      )

      editorActions.setDocument(doc)
      editorActions.setEditorPage('app')
    } else if (/^image\//.test(file.type)) {
      const { image, url } = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)

      URL.revokeObjectURL(url)

      const doc = SilkEntity.Document.create({
        width: layer.width,
        height: layer.height,
      })
      doc.addLayer(layer)

      editorActions.setDocument(doc)
      editorActions.setEditorPage('app')
    }
  }, [])

  const handleClickDropArea = useCallback(async () => {
    const [file] = await selectFile({
      extensions: ['.silk', '.png', '.jpg'],
      multiple: false,
    })
    if (!file) return

    handleFileSelected(file)
  }, [handleFileSelected])

  const handleClickDarkTheme = useCallback(
    () => editorActions.setTheme('dark'),
    []
  )
  const handleClickLightTheme = useCallback(
    () => editorActions.setTheme('light'),
    []
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
                    editorState.currentTheme === 'dark'
                      ? theme.exactColors.black40
                      : undefined,
                  backgroundColor:
                    editorState.currentTheme === 'dark'
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
                    editorState.currentTheme === 'light'
                      ? theme.exactColors.white40
                      : undefined,
                  backgroundColor:
                    editorState.currentTheme === 'light'
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

const PageSwitch = () => {
  const [editorState, editorActions] = useLysSliceRoot(EditorSlice)
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, false)

  useEffect(() => {
    editorActions.setEditorMode(isNarrowMedia ? 'sp' : 'pc')
  }, [])

  return (
    <ThemeProvider
      theme={editorState.currentTheme === 'dark' ? theme : lightTheme}
    >
      <Head>
        <meta
          name="viewport"
          content="viewport-fit=cover, width=device-width, initial-scale=1"
        />
      </Head>
      <>
        {editorState.editorPage === 'home' ? <HomeContent /> : <IndexContent />}
      </>
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

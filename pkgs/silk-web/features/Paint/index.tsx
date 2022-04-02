import { useFleurContext, useStore } from '@fleur/react'
import {
  letDownload,
  loadImageFromBlob,
  match,
  useAsyncEffect,
} from '@hanakla/arma'
import {
  ChangeEvent,
  MouseEvent,
  TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useClickAway, useDrop, useToggle, useUpdate } from 'react-use'
import { useGesture } from 'react-use-gesture'

import { Silk, SilkEntity, SilkHelper, SilkSerializer } from 'silk-core'
import { createGlobalStyle, css } from 'styled-components'
import useMeasure from 'use-measure'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { Menu } from '@styled-icons/remix-line'
import { useTranslation } from 'next-i18next'

import { Sidebar } from '🙌/components/Sidebar'
import { FilterView } from './containers/FilterView'
import { LayerView } from './containers/LayerView'
import { editorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useGlobalMouseTrap } from '🙌/hooks/useMouseTrap'
import { useTap } from '🙌/hooks/useTap'
import { EngineContextProvider } from '🙌/lib/EngineContext'
import { useMedia } from '🙌/utils/hooks'
import { ControlsOverlay } from './containers/ControlsOverlay'
import { MainActions } from '../Paint/containers/MainActions/MainActions'
import { DebugView } from './containers/DebugView'
import { centering } from '🙌/utils/mixins'
import { rgba } from 'polished'
import { theme } from '🙌/utils/theme'
import { Button } from '🙌/components/Button'
import { narrow } from '🙌/utils/responsive'

export function PaintPage({}) {
  const { t } = useTranslation('app')

  const { executeOperation } = useFleurContext()
  const {
    currentDocument,
    activeLayer,
    currentTool,
    currentTheme,
    renderSetting,
  } = useStore((get) => ({
    currentDocument: EditorSelector.currentDocument(get),
    activeLayer: EditorSelector.activeLayer(get),
    currentTool: get(EditorStore).state.currentTool,
    currentTheme: get(EditorStore).state.currentTheme,
    renderSetting: get(EditorStore).state.renderSetting,
  }))
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

        executeOperation(editorOps.updateDocument, (document) => {
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
      executeOperation(editorOps.setRenderSetting, {
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

  const handleClickDarkTheme = useCallback(() => {
    executeOperation(editorOps.setTheme, 'dark')
  }, [])

  const handleClickLightTheme = useCallback(() => {
    executeOperation(editorOps.setTheme, 'light')
  }, [])

  const dragState = useDrop({ onFiles: handleOnDrop })
  const tapBind = useTap(handleTapEditArea)

  useGlobalMouseTrap(
    [
      {
        key: 'v',
        handler: () => executeOperation(editorOps.setTool, 'cursor'),
      },
      { key: 'b', handler: () => executeOperation(editorOps.setTool, 'draw') },
      { key: 'e', handler: () => executeOperation(editorOps.setTool, 'erase') },
      {
        key: 'p',
        handler: () => executeOperation(editorOps.setTool, 'shape-pen'),
      },
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
    executeOperation(editorOps.setEngine, engine.current)

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
      executeOperation(editorOps.setActiveLayer, vector.id)

      engine.current.on('rerender', rerender)
      engine.current.rerender()

      executeOperation(editorOps.setFill, {
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
              currentTool === 'cursor' ? 'default' :
              currentTool === 'draw' ? 'url(cursors/pencil.svg), auto' :
              currentTool === 'erase' ? 'url(cursors/eraser.svg), auto' :
              currentTool === 'shape-pen' ? 'url(cursors/pencil-line.svg), auto':
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
                      checked={renderSetting.disableAllFilters}
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

const TouchActionStyle = createGlobalStyle`
  html, body { touch-action: none; }
`

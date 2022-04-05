import { useFleurContext, useStore } from '@fleur/react'
import {
  letDownload,
  loadImageFromBlob,
  match,
  useAsyncEffect,
  useFunk,
} from '@hanakla/arma'
import {
  ChangeEvent,
  MouseEvent,
  TouchEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useClickAway, useDrop, useToggle, useUpdate } from 'react-use'
import { useGesture } from 'react-use-gesture'
import { autoPlacement, shift, useFloating } from '@floating-ui/react-dom'

import {
  CanvasHandler,
  RenderStrategies,
  Session,
  Silk3,
  SilkBrushes,
  SilkDOM,
  SilkHelper,
  SilkSerializer,
} from 'silk-core'
import { css } from 'styled-components'
import useMeasure from 'use-measure'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { Menu } from '@styled-icons/remix-line'
import { useTranslation } from 'next-i18next'

import { Sidebar } from '🙌/components/Sidebar'
import { FilterView } from './containers/FilterView'
import { LayerView } from './containers/LayerView'
import { editorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import {
  useFunkyGlobalMouseTrap,
  useGlobalMouseTrap,
} from '🙌/hooks/useMouseTrap'
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
import { isEventIgnoringTarget } from './helpers'
import { Tooltip } from '🙌/components/Tooltip'
import { NotifyOps, useNotifyConsumer } from '🙌/domains/Notify'

export function PaintPage({}) {
  const { t } = useTranslation('app')

  const { executeOperation, getStore } = useFleurContext()
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

  const engine = useRef<Silk3 | null>(null)
  const session = useRef<Session | null>(null)
  const canvasHandler = useRef<CanvasHandler | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editAreaRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)

  const saveFloat = useFloating({
    placement: 'top',
    middleware: [shift(), autoPlacement({ allowedPlacements: ['top-start'] })],
  })

  const editorBound = useMeasure(editAreaRef)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const rerender = useUpdate()
  const [sidebarOpened, sidebarToggle] = useToggle(!isNarrowMedia)
  const [scale, setScale] = useState(0.5)
  const [rotate, setRotate] = useState(0)
  const [saveMessage] = useNotifyConsumer('save', 1)
  // const sidebarStyles = useSpring({
  //   width: isNarrowMedia === false || sidebarOpened ? 200 : 32,
  // })

  const handleOnDrop = useFunk(async (files: File[]) => {
    if (!currentDocument) return

    let lastLayerId: string | null = activeLayer?.uid ?? null

    for (const file of files) {
      const { image } = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)

      executeOperation(editorOps.updateDocument, (document) => {
        document.addLayer(layer, {
          aboveLayerId: lastLayerId,
        })
      })

      lastLayerId = layer.uid
    }
  })

  const handleTapEditArea = useFunk(
    ({ touches }: TouchEvent<HTMLDivElement>) => {
      if (touches.length === 2) console.log('undo')
      if (touches.length === 3) console.log('redo')
    }
  )

  const handleChangeDisableFilters = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      executeOperation(editorOps.setRenderSetting, {
        disableAllFilters: currentTarget.checked,
      })
    }
  )

  const handleClickExport = useFunk(async () => {
    if (!currentDocument) return

    const bin = SilkSerializer.exportDocument(
      currentDocument as SilkDOM.Document
    )!
    const blob = new Blob([bin], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)

    if (typeof window.showSaveFilePicker === 'undefined') {
      letDownload(url, 'test.silk')
    } else {
      const handler =
        getStore(EditorStore).state.currentFileHandler ??
        (await window.showSaveFilePicker({
          types: [
            {
              description: 'Silk project',
              accept: { 'application/octet-stream': '.silk' },
            },
          ],
        }))

      await (
        await handler.createWritable({ keepExistingData: false })
      ).write(blob)

      executeOperation(editorOps.setCurrentFileHandler, handler)
    }

    setTimeout(() => URL.revokeObjectURL(url), 10000)
  })

  const handleClickExportAs = useFunk(async (e: MouseEvent<HTMLDivElement>) => {
    const { currentTarget } = e
    e.stopPropagation()

    if (!currentDocument || !engine.current) return

    const type = currentTarget.dataset.type!
    const mime = match(type)
      .when('png', 'image/png')
      .when('jpeg', 'image/jpeg')
      ._(new Error(`Unexpected type ${type}`))

    const exporter = await engine.current.renderAndExport(currentDocument)

    const blob = await exporter.export(mime, 1.0)
    const url = URL.createObjectURL(blob)

    letDownload(
      url,
      !currentDocument.title
        ? `${t('untitled')}.${type}`
        : `${currentDocument.title}.${type}`
    )

    executeOperation(NotifyOps.create, {
      area: 'save',
      timeout: 3000,
      message: t('exports.exported'),
    })
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  })

  const handleClickDarkTheme = useFunk(() => {
    executeOperation(editorOps.setTheme, 'dark')
  })

  const handleClickLightTheme = useFunk(() => {
    executeOperation(editorOps.setTheme, 'light')
  })

  const dragState = useDrop({ onFiles: handleOnDrop })
  // const tapBind = useTap(handleTapEditArea)

  useFunkyGlobalMouseTrap(['ctrl+s', 'command+s'], () => {
    getStore(EditorStore)
  })

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

  useClickAway(sidebarRef, (e) => {
    if (!isNarrowMedia) return
    if (isEventIgnoringTarget(e.target)) return

    sidebarToggle(false)
  })

  // Initialize Silk
  useAsyncEffect(async () => {
    ;(window as any).engine = engine.current = await Silk3.create({
      canvas: canvasRef.current!,
    })

    const session = ((window as any)._session =
      engine.current?.createSession(null))

    const strategy = new RenderStrategies.DifferenceRender()
    session.setRenderStrategy(strategy)

    await executeOperation(editorOps.initEngine, {
      engine: engine.current,
      session,
      strategy,
    })
    await executeOperation(editorOps.setBrush, SilkBrushes.ScatterBrush.id)

    canvasHandler.current = new CanvasHandler(canvasRef.current!)
    canvasHandler.current.connect(session, strategy, engine.current)

    if (process.env.NODE_ENV !== 'development') {
    } else {
      await executeOperation(editorOps.setDocument, null)

      const document = SilkDOM.Document.create({ width: 1000, height: 1000 })
      // session.setDocument(document)
      await executeOperation(editorOps.setDocument, document)

      const layer = SilkDOM.RasterLayer.create({ width: 1000, height: 1000 })
      const vector = SilkDOM.VectorLayer.create({
        visible: false,
      })
      const text = SilkDOM.TextLayer.create({})
      const filter = SilkDOM.FilterLayer.create({})

      vector.filters.push(
        SilkDOM.Filter.create({
          filterId: '@silk-core/gauss-blur',
          settings: engine.current.toolRegistry.getFilterInstance(
            '@silk-core/gauss-blur'
          )!.initialConfig,
        }),
        SilkDOM.Filter.create({
          filterId: '@silk-core/chromatic-aberration',
          settings: engine.current.toolRegistry.getFilterInstance(
            '@silk-core/chromatic-aberration'
          )!.initialConfig,
        })
      )

      document.layers.push(layer)
      document.layers.push(vector)
      document.layers.push(text)
      document.layers.push(filter)

      await executeOperation(editorOps.setActiveLayer, layer.uid)

      await executeOperation(editorOps.setFill, {
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
    if (!session.current) return
    canvasHandler.current!.scale = scale
  }, [scale])

  useEffect(() => {
    if (!currentDocument) return

    const autoSave = () => {
      executeOperation(editorOps.autoSave, currentDocument!.uid)
      executeOperation(NotifyOps.create, {
        area: 'save',
        message: t('exports.autoSaved'),
        timeout: 3000,
      })
    }

    const id = window.setInterval(autoSave, 10000)
    autoSave()

    return () => window.clearInterval(id)
  }, [currentDocument?.uid])

  return (
    <EngineContextProvider value={engine.current!}>
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
              data-is-paint-canvas="yup"
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
                  css={css`
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
                      position: relative;
                      margin-left: auto;
                    `}
                    ref={saveFloat.reference}
                  >
                    <span
                      style={{
                        position: saveFloat.strategy,
                        top: saveFloat.y?.toString() ?? '',
                        left: saveFloat.x?.toString() ?? '',
                        transition: 'all .2s ease-in-out',
                        pointerEvents: 'none',
                        opacity: 0,
                        transform: 'translateY(0%)',
                        ...(saveMessage
                          ? {
                              opacity: 1,
                              transform: 'translateY(calc(-100% - 8px))',
                            }
                          : {}),
                      }}
                    >
                      <Tooltip ref={saveFloat.floating}>
                        {saveMessage?.message}
                      </Tooltip>
                    </span>
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

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
  memo,
  MouseEvent,
  RefObject,
  TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  useClickAway,
  useDrop,
  useDropArea,
  useInterval,
  useToggle,
  useUpdate,
} from 'react-use'
import { useGesture, useDrag } from 'react-use-gesture'
import { autoPlacement, shift, useFloating } from '@floating-ui/react-dom'

import {
  CanvasHandler,
  RenderStrategies,
  SilkSession,
  Silk3,
  SilkBrushes,
  SilkDOM,
  SilkHelper,
  SilkSerializer,
  SilkCommands,
  SilkCanvasFactory,
} from 'silk-core'
import { css, useTheme } from 'styled-components'
import useMeasure from 'use-measure'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { Menu } from '@styled-icons/remix-line'
import { useTranslation } from 'next-i18next'

import { Sidebar } from '🙌/components/Sidebar'
import { FilterView } from './containers/FilterView'
import { LayerView } from './containers/LayerView'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import {
  useFunkyGlobalMouseTrap,
  useGlobalMouseTrap,
} from '🙌/hooks/useMouseTrap'
import { EngineContextProvider } from '🙌/lib/EngineContext'
import { useMedia } from '🙌/utils/hooks'
import { ControlsOverlay } from './containers/ControlsOverlay'
import { MainActions } from '../Paint/containers/MainActions/MainActions'
import { DebugView } from './containers/DebugView'
import { centering, checkerBoard } from '🙌/utils/mixins'
import { rgba } from 'polished'
import { darkTheme } from '🙌/utils/theme'
import { Button } from '🙌/components/Button'
import { media, narrow } from '🙌/utils/responsive'
import { isEventIgnoringTarget, swapObjectBrushAndFill } from './helpers'
import { Tooltip } from '🙌/components/Tooltip'
import { NotifyOps, useNotifyConsumer } from '🙌/domains/Notify'
import { SidebarPane } from '🙌/components/SidebarPane'
import { BrushPresets } from './containers/BrushPresets'
import { ThemeProp } from '🙌/utils/theme'
import { Dropzone } from '🙌/components/Dropzone'
import { DndContext, useDraggable } from '@dnd-kit/core'
import { nanoid } from 'nanoid'
import { CSS } from '@dnd-kit/utilities'
import { FloatingWindow } from '🙌/components/FloatingWindow'
import { exportProject } from '🙌/domains/EditorStable/exportProject'
import { LoadingLock } from '🙌/containers/LoadingLock'
import { log } from '../../utils/log'

export const PaintPage = memo(function PaintPage({}) {
  const { t } = useTranslation('app')
  const theme = useTheme()

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
  const session = useRef<SilkSession | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editAreaRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)

  const saveFloat = useFloating({
    placement: 'top',
    middleware: [shift(), autoPlacement({ allowedPlacements: ['top-start'] })],
  })

  const editorBound = useMeasure(editAreaRef)
  const rerender = useUpdate()
  const [sidebarOpened, sidebarToggle] = useToggle(!isNarrowMedia)
  const [stream, setStream] = useState<MediaStream | null>(null)
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

      executeOperation(EditorOps.updateDocument, (document) => {
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
      executeOperation(EditorOps.setRenderSetting, {
        disableAllFilters: currentTarget.checked,
      })
    }
  )

  const handleClickExport = useFunk(async () => {
    if (!currentDocument) return

    const { blob } = exportProject(currentDocument, getStore)
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

      executeOperation(EditorOps.setCurrentFileHandler, handler)
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
    executeOperation(EditorOps.setTheme, 'dark')
  })

  const handleClickLightTheme = useFunk(() => {
    executeOperation(EditorOps.setTheme, 'light')
  })

  const [bindDrop, dragState] = useDropArea({ onFiles: handleOnDrop })
  // const tapBind = useTap(handleTapEditArea)

  useFunkyGlobalMouseTrap(['ctrl+s', 'command+s'], (e) => {
    e.preventDefault()
    handleClickExport()
  })

  useFunkyGlobalMouseTrap(['ctrl+z', 'command+z'], () => {
    executeOperation(EditorOps.undoCommand)
  })

  useFunkyGlobalMouseTrap(['ctrl+shift+z', 'command+shift+z', 'ctrl+y'], () => {
    executeOperation(EditorOps.redoCommand)
  })

  useFunkyGlobalMouseTrap(['v'], () =>
    executeOperation(
      EditorOps.setTool,
      currentTool === 'cursor' && activeLayer?.layerType === 'vector'
        ? 'point-cursor'
        : 'cursor'
    )
  )

  useFunkyGlobalMouseTrap(['b'], () =>
    executeOperation(EditorOps.setTool, 'draw')
  )

  useFunkyGlobalMouseTrap(['e'], () =>
    executeOperation(EditorOps.setTool, 'erase')
  )

  useFunkyGlobalMouseTrap(['p'], () =>
    executeOperation(EditorOps.setTool, 'shape-pen')
  )

  useFunkyGlobalMouseTrap(['tab'], (e) => {
    e.preventDefault()
    sidebarToggle()
  })

  useFunkyGlobalMouseTrap(['ctrl+0', 'command+0'], (e) => {
    executeOperation(EditorOps.setCanvasTransform, {
      scale: 1,
      pos: { x: 0, y: 0 },
    })
  })

  useFunkyGlobalMouseTrap(['/'], () => {
    const path = EditorSelector.activeLayerPath(getStore)
    const o = EditorSelector.activeObject(getStore)
    const target = EditorSelector.vectorColorTarget(getStore)

    if (!path || !o) return

    executeOperation(
      EditorOps.runCommand,
      new SilkCommands.VectorLayer.PatchObjectAttr({
        objectUid: o.uid,
        pathToTargetLayer: path,
        patch: target === 'fill' ? { fill: null } : { brush: null },
      })
    )
  })

  useFunkyGlobalMouseTrap(['shift+x'], () => {
    executeOperation(EditorOps.updateActiveObject, (o) => {
      swapObjectBrushAndFill(o, { fallbackBrushId: SilkBrushes.Brush.id })
    })
  })

  useGesture(
    {
      onPinch: ({ delta: [d, r] }) => {
        executeOperation(EditorOps.setCanvasTransform, {
          scale: (prev) => Math.max(0.1, prev + d / 400),
        })
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

    const session = ((window as any)._session = await SilkSession.create())
    session.setBrushSetting({ color: { r: 0.3, g: 0.3, b: 0.3 } })

    const strategy = new RenderStrategies.DifferenceRender()
    session.setRenderStrategy(strategy)

    executeOperation(EditorOps.initEngine, {
      engine: engine.current,
      session,
      strategy,
    })
    executeOperation(EditorOps.setBrushSetting, {
      brushId: SilkBrushes.ScatterBrush.id,
    })

    if (process.env.NODE_ENV !== 'development') {
      const document = EditorSelector.currentDocument(getStore)
      if (document) {
        executeOperation(EditorOps.setActiveLayer, [document.layers[0].uid])
      }
    } else {
      if (EditorSelector.currentDocument(getStore) != null) return

      const document = SilkDOM.Document.create({ width: 1000, height: 1000 })
      executeOperation(EditorOps.setDocument, document)

      const layer = SilkDOM.RasterLayer.create({ width: 1000, height: 1000 })
      const vector = SilkDOM.VectorLayer.create({
        visible: true,
      })

      {
        const path = SilkDOM.Path.create({
          points: [
            { x: 0, y: 0, in: null, out: null },
            { x: 200, y: 500, in: null, out: null },
            { x: 600, y: 500, in: null, out: null },
            {
              x: 1000,
              y: 1000,
              in: null,
              out: null,
            },
          ],
          closed: true,
        })

        const obj = SilkDOM.VectorObject.create({ x: 0, y: 0, path })

        obj.brush = {
          brushId: SilkBrushes.ScatterBrush.id,
          color: { r: 0, g: 0, b: 0 },
          opacity: 1,
          size: 2,
        }

        obj.fill = null
        // obj.fill = {
        //   type: 'linear-gradient',
        //   opacity: 1,
        //   start: { x: -100, y: -100 },
        //   end: { x: 100, y: 100 },
        //   colorStops: [
        //     { color: { r: 0, g: 1, b: 1, a: 1 }, position: 0 },
        //     { color: { r: 1, g: 0.2, b: 0.1, a: 1 }, position: 1 },
        //   ],
        // }

        vector.objects.push(obj)
      }

      const text = SilkDOM.TextLayer.create({})
      const filter = SilkDOM.FilterLayer.create({})
      const group = SilkDOM.GroupLayer.create({
        layers: [
          SilkDOM.RasterLayer.create({ width: 1000, height: 1000 }),
          SilkDOM.VectorLayer.create({}),
        ],
      })

      const reference = SilkDOM.ReferenceLayer.create({
        referencedLayerId: layer.uid,
      })
      reference.x = 20

      vector.filters
        .push
        // SilkDOM.Filter.create({
        //   filterId: '@silk-core/gauss-blur',
        //   visible: true,
        //   settings: engine.current.toolRegistry.getFilterInstance(
        //     '@silk-core/gauss-blur'
        //   )!.initialConfig,
        // }),
        // SilkDOM.Filter.create({
        //   filterId: '@silk-core/chromatic-aberration',
        //   visible: true,
        //   settings: engine.current.toolRegistry.getFilterInstance(
        //     '@silk-core/chromatic-aberration'
        //   )!.initialConfig,
        // }),
        // SilkDOM.Filter.create({
        //   filterId: '@silk-core/noise',
        //   visible: true,
        //   settings:
        //     engine.current.toolRegistry.getFilterInstance('@silk-core/noise')!
        //       .initialConfig,
        // }),
        // SilkDOM.Filter.create({
        //   filterId: '@silk-core/binarization',
        //   visible: true,
        //   settings: engine.current.toolRegistry.getFilterInstance(
        //     '@silk-core/binarization'
        //   )!.initialConfig,
        // }),
        // SilkDOM.Filter.create({
        //   filterId: '@silk-core/low-reso',
        //   visible: true,
        //   settings: engine.current.toolRegistry.getFilterInstance(
        //     '@silk-core/low-reso'
        //   )!.initialConfig,
        // })
        ()

      document.layers.push(layer)
      document.layers.push(vector)
      document.layers.push(text)
      document.layers.push(filter)
      document.layers.push(group)
      document.layers.unshift(reference)

      // await executeOperation(EditorOps.createSession, document)
      await executeOperation(EditorOps.setActiveLayer, [vector.uid])

      await executeOperation(EditorOps.setFill, {
        type: 'linear-gradient',
        colorStops: [
          { color: { r: 0, g: 1, b: 1, a: 1 }, position: 0 },
          { color: { r: 0.5, g: 1, b: 0.8, a: 1 }, position: 1 },
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

    const stream = canvasRef.current!.captureStream(5)
    setStream(stream)

    rerender()

    return () => {}
  }, [])

  useInterval(() => {
    if (process.env.NODE_ENV === 'development') {
      const bytes =
        getStore(EditorStore).state.session?.getDocumentUsedMemoryBytes() ?? 0

      log(
        `Document holding bytes: ${byteToMiB(bytes)} MiB${
          performance.memory
            ? `, Heap: ${byteToMiB(
                performance.memory!.usedJSHeapSize
              )} MiB / ${byteToMiB(performance.memory.jsHeapSizeLimit)} MiB`
            : ''
        }, Canvas holdings ${byteToMiB(SilkCanvasFactory.getCanvasBytes())} MiB
        `
      )
    }
  }, 4000)

  useEffect(() => {
    const handleCanvasWheel = (e: WheelEvent) => {
      executeOperation(EditorOps.setCanvasTransform, {
        pos: ({ x, y }) => ({
          x: x - e.deltaX * 0.5,
          y: y - e.deltaY * 0.5,
        }),
      })

      e.preventDefault()
    }

    editAreaRef.current?.addEventListener('wheel', handleCanvasWheel, {
      passive: false,
    })

    return () =>
      editAreaRef.current?.removeEventListener('wheel', handleCanvasWheel)
  }, [])

  useEffect(() => {
    if (!currentDocument) return

    const autoSave = () => {
      executeOperation(EditorOps.autoSave, currentDocument!.uid)
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
      <LoadingLock />
      <div
        ref={rootRef}
        css={css`
          position: relative;
          display: flex;
          flex-flow: row;
          width: 100%;
          height: 100%;
          background-color: ${({ theme }) => theme.color.background1};
          color: ${({ theme }) => theme.color.text2};
        `}
        {...bindDrop}
      >
        <ReferenceImageWindow />

        <CanvasPreviewWindow stream={stream} />

        <>
          <div
            css={`
              ${media.narrow`
                display: none;
              `}
            `}
            ref={sidebarRef}
          >
            <Sidebar
              style={{
                width: sidebarOpened ? 200 : 32,
              }}
              closed={!sidebarOpened}
              side="left"
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
            background-color: ${rgba('#11111A', 0.3)};
          `}
          style={{
            // prettier-ignore
            cursor:
              currentTool === 'cursor' ? 'default' :
              currentTool === 'draw' ? `${theme.cursors.pencil}, auto` : // 'url(cursors/pencil.svg), auto' :
              currentTool === 'erase' ? `${theme.cursors.eraser}, auto` : // 'url(cursors/eraser.svg), auto' :
              currentTool === 'shape-pen' ? `${theme.cursors.pencilLine}, auto` : // 'url(cursors/pencil-line.svg), auto':
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

          <PaintCanvas canvasRef={canvasRef} />

          <svg
            // Match to Editor bounding
            data-devmemo="Editor bounding svg"
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
            <ControlsOverlay editorBound={editorBound} />
          </svg>
          <div
            css={`
              position: absolute;
              left: 50%;
              bottom: 16px;
              transform: translateX(-50%);

              ${media.narrow`
                bottom: 0;
                width: 100%;
              `}
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
          <Sidebar
            css={`
              ${media.narrow`
                  display: none;
                `}
            `}
            style={{
              width: sidebarOpened ? 200 : 32,
            }}
            closed={!sidebarOpened}
            side="right"
          >
            <SidebarPane heading={t('colorHistory')}>まだないよ</SidebarPane>

            <BrushPresets />

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
              ></div>
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
                    css={`
                      margin-right: 4px;
                    `}
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
                          ? darkTheme.exactColors.black40
                          : undefined,
                      backgroundColor:
                        currentTheme === 'dark'
                          ? darkTheme.exactColors.white40
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
                          ? darkTheme.exactColors.white40
                          : undefined,
                      backgroundColor:
                        currentTheme === 'light'
                          ? darkTheme.exactColors.black40
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
        </>
      </div>
    </EngineContextProvider>
  )
})

const PaintCanvas = memo(function PaintCanvas({
  canvasRef,
}: {
  canvasRef: RefObject<HTMLCanvasElement>
}) {
  const canvasHandler = useRef<CanvasHandler | null>(null)
  const { session, engine, renderStrategy, scale, pos } = useStore((get) => ({
    session: get(EditorStore).state.session,
    engine: get(EditorStore).state.engine,
    renderStrategy: get(EditorStore).state.renderStrategy,
    scale: get(EditorStore).state.canvasScale,
    pos: get(EditorStore).state.canvasPosition,
  }))

  useEffect(() => {
    if (!session || !engine || !renderStrategy) return
    const handler = (canvasHandler.current = new CanvasHandler(
      canvasRef.current!
    ))
    canvasHandler.current.connect(session, renderStrategy, engine)

    return () => {
      handler.dispose()
    }
  }, [session, renderStrategy, engine])

  useEffect(() => {
    if (!canvasHandler.current) return
    canvasHandler.current!.scale = scale
  }, [scale])

  return (
    <div
      css={`
        position: absolute;
      `}
      style={{
        transform: `scale(${scale}) rotate(0deg) translate(${pos.x}px, ${pos.y}px)`,
      }}
    >
      <canvas
        css={`
          background-color: white;
          ${checkerBoard({ size: 8, opacity: 0.1 })}
          box-shadow: 0 0 16px rgba(0, 0, 0, 0.1);
        `}
        data-is-paint-canvas="yup"
        ref={canvasRef}
      />
    </div>
  )
})

const ReferenceImageWindow = memo(function ReferenceImageWindow() {
  const [opened, toggleOpened] = useToggle(false)
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referencePosition, setReferencePosition] = useState({ x: 200, y: 0 })

  const handleDropReference = useFunk(async (files: File[]) => {
    if (referenceImage != null) URL.revokeObjectURL(referenceImage)

    const { image, url } = await loadImageFromBlob(files[0])
    setReferenceImage(url)
  })

  return (
    <FloatingWindow title="Reference">
      {referenceImage ? (
        <img
          css={`
            max-width: 100%;
            user-select: none;
            pointer-events: none;
          `}
          src={referenceImage}
        />
      ) : (
        <Dropzone
          css={`
            padding: 16px 0;
            text-align: center;
          `}
          onFilesDrop={handleDropReference}
        >
          リファレンス画像を選ぶ
        </Dropzone>
      )}
    </FloatingWindow>
  )
})

const CanvasPreviewWindow = memo(function CanvasPreviewWindow({
  stream,
}: {
  stream: MediaProvider | null
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [mirror, toggleMirror] = useToggle(false)

  useEffect(() => {
    videoRef.current!.srcObject = stream
  }, [stream])

  return (
    <FloatingWindow title="Preview">
      <label>
        <input type="checkbox" checked={mirror} onChange={toggleMirror} />
        左右反転
      </label>
      <video
        css={`
          width: 100%;
        `}
        ref={videoRef}
        style={{
          transform: mirror ? 'scaleX(-1)' : undefined,
        }}
        autoPlay
        playsInline
        disablePictureInPicture
      />
    </FloatingWindow>
  )
})

const byteToMiB = (byte: number) => Math.round((byte / 1024 / 1024) * 100) / 100

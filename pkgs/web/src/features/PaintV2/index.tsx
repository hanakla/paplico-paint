import useEvent from 'react-use-event-hook'
import { useFleurContext, useStore } from '@fleur/react'
import {
  letDownload,
  loadImageFromBlob,
  match,
  useAsyncEffect,
} from '@hanakla/arma'
import {
  ChangeEvent,
  forwardRef,
  memo,
  MouseEvent,
  PointerEvent,
  RefObject,
  MutableRefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  useClickAway,
  useDropArea,
  useInterval,
  useToggle,
  useUpdate,
} from 'react-use'
import { useGesture } from 'react-use-gesture'
import { autoPlacement, shift, useFloating } from '@floating-ui/react-dom'
import { useRouter } from 'next/router'
import { css, keyframes, useTheme } from 'styled-components'
import useMeasure from 'use-measure'
import { Moon, Sun } from '@styled-icons/remix-fill'
import { Menu } from '@styled-icons/remix-line'
import { useTranslation } from 'next-i18next'
import { fit } from 'object-fit-math'

import {
  Paplico,
  CanvasFactory,
  ExtraBrushes,
  Document,
} from '@paplico/core-new'
import isiOS from 'is-ios'

import { Sidebar } from '🙌/components/Sidebar'
import { FilterView } from './containers/FilterView'
import { LayerView } from './containers/LayerView'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunkyGlobalMouseTrap } from '🙌/hooks/useMouseTrap'
import {
  useFleur,
  useIsiPadOS,
  useMedia,
  useMultiFingerTouch,
} from '🙌/utils/hooks'
import { ControlsOverlay } from './containers/ControlsOverlay'
import { MainActions } from './containers/MainActions/MainActions'

import { centering, checkerBoard } from '🙌/utils/mixins'
import { rgba } from 'polished'
import { darkTheme, ThemeProp } from '🙌/utils/theme'
import { Button } from '🙌/components/Button'
import { media, narrow } from '🙌/utils/responsive'
import {
  isEventIgnoringTarget,
  normalRgbToRgbArray,
  swapObjectBrushAndFill,
} from './helpers'
import { Tooltip } from '🙌/components/Tooltip'
import { NotifyOps, useNotifyConsumer } from '🙌/domains/Notify'
import { SidebarPane } from '🙌/components/SidebarPane'
import { BrushPresets } from './containers/BrushPresets'
import { Dropzone } from '🙌/components/Dropzone'
import { log } from '🙌/utils/log'
import { DOMUtils } from '🙌/utils/dom'
import { FloatingWindow } from '🙌/components/FloatingWindow'
import { exportProject } from '🙌/domains/EditorStable/exportProject'
import { combineRef } from '../../utils/react'
import { PaintCanvasContext, useWhiteNoise } from './hooks'
import { Testing } from './testing'
import useSound from 'use-sound'
import { Howl } from 'howler'
import { debounce } from '../../utils/func'
import { bindDevToolAPI } from './devToolsAPI'
import { ReferenceImageWindow } from './views/ReferenceImageWindow'
import { HistoryFlash } from './views/HistoryFlash'
import { PaplicoEngineContext, PaplicoEngineProvider } from './contexts/engine'

export const PaintV2 = memo(function PaintPage({}) {
  const { t } = useTranslation('app')
  const theme = useTheme()
  const router = useRouter()

  const { executeOperation } = useFleurContext()
  const { execute, getStore } = useFleur()
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
  const isIpadOS = useIsiPadOS()

  const engine = useRef<Paplico | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editAreaRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)

  const saveFloat = useFloating({
    placement: 'top',
    middleware: [shift(), autoPlacement({ allowedPlacements: ['top-start'] })],
  })

  const rerender = useUpdate()
  const [sidebarOpened, sidebarToggle] = useToggle(!isNarrowMedia)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const [saveMessage] = useNotifyConsumer('save', 1)

  const handleOnDrop = useEvent(async ([file]: File[]) => {
    if (!currentDocument) return

    const { image } = await loadImageFromBlob(file)
    const layer = await PapHelper.imageToLayer(image)

    execute(
      EditorOps.runCommand,
      new PapCommands.Document.AddLayer({
        layer,
      })
    )
    execute(EditorOps.setActiveLayer, [layer.uid])
  })

  const handleChangeDisableFilters = useEvent(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      executeOperation(EditorOps.setRenderSetting, {
        disableAllFilters: currentTarget.checked,
      })
    }
  )

  const handleClickExport = useEvent(async () => {
    if (!currentDocument) return

    const { blob } = exportProject(currentDocument, getStore)
    const url = URL.createObjectURL(blob)

    if (typeof window.showSaveFilePicker === 'undefined') {
      letDownload(url, 'test.paplc')
    } else {
      const handler =
        getStore(EditorStore).state.currentFileHandler ??
        (await window.showSaveFilePicker({
          types: [
            {
              description: 'Paplico project',
              accept: { 'application/octet-stream': '.paplc' },
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

  const handleClickExportAs = useEvent(
    async (e: MouseEvent<HTMLDivElement>) => {
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
        messageKey: t('exports.exported'),
      })
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }
  )

  const handleClickExportAsPsd = useEvent(async (e: MouseEvent) => {
    e.stopPropagation()

    if (!currentDocument) return

    execute(NotifyOps.create, {
      area: 'loadingLock',
      timeout: 0,
      messageKey: t('appMenu.exporting'),
      lock: true,
    })

    try {
      const exporter = new PapExporter.PSD()
      const blob = await exporter.export(engine.current!, currentDocument)
      const url = URL.createObjectURL(blob)

      letDownload(
        url,
        !currentDocument.title
          ? `${t('untitled')}.psd`
          : `${currentDocument.title}.psd`
      )

      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } finally {
      execute(NotifyOps.create, {
        area: 'loadingLock',
        timeout: 0,
        messageKey: t('appMenu.exported'),
        lock: false,
      })
    }
  })

  const handleClickDarkTheme = useEvent(() => {
    executeOperation(EditorOps.setTheme, 'dark')
  })

  const handleClickLightTheme = useEvent(() => {
    executeOperation(EditorOps.setTheme, 'light')
  })

  const [bindDrop, dragState] = useDropArea({ onFiles: handleOnDrop })

  useFunkyGlobalMouseTrap(['ctrl+s', 'command+s'], (e) => {
    e.preventDefault()

    executeOperation(EditorOps.saveCurrentDocumentToIdb, { notify: true })
  })
  useFunkyGlobalMouseTrap(['ctrl+shift+s', 'command+shift+s'], (e) => {
    e.preventDefault()
    handleClickExport()
  })

  useFunkyGlobalMouseTrap(['ctrl+z', 'command+z'], () => {
    if (!engine.current?.command.canUndo()) {
      execute(NotifyOps.create, {
        area: 'commandFlash',
        timeout: 1000,
        messageKey: 'undoEmpty',
      })

      return
    }

    engine.current?.command.undo()?.then(() => {
      execute(NotifyOps.create, {
        area: 'commandFlash',
        timeout: 1000,
        messageKey: 'undo',
      })
    })
  })

  useFunkyGlobalMouseTrap(['ctrl+shift+z', 'command+shift+z', 'ctrl+y'], () => {
    if (!engine.current?.command.canRedo()) {
      execute(NotifyOps.create, {
        area: 'commandFlash',
        timeout: 1000,
        messageKey: 'redoEmpty',
      })
      return
    }

    engine.current?.command.redo()?.then(() => {
      execute(NotifyOps.create, {
        area: 'commandFlash',
        timeout: 1000,
        messageKey: 'redo',
      })
    })
  })

  useFunkyGlobalMouseTrap(['v'], () =>
    executeOperation(EditorOps.setTool, 'cursor')
  )

  useFunkyGlobalMouseTrap(['i'], () =>
    executeOperation(EditorOps.setTool, 'dropper')
  )

  useFunkyGlobalMouseTrap(['a'], () =>
    executeOperation(EditorOps.setTool, 'point-cursor')
  )

  useFunkyGlobalMouseTrap(['b'], () => {
    executeOperation(EditorOps.setTool, 'draw')
  })

  useFunkyGlobalMouseTrap(['x'], () => {
    const vectorColorTarget = EditorSelector.vectorColorTarget(getStore)
    executeOperation(
      EditorOps.setVectorColorTarget,
      vectorColorTarget === 'fill' ? 'stroke' : 'fill'
    )
  })

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

  useFunkyGlobalMouseTrap(['command+up', 'ctrl+up'], (e) => {
    const activeLayer = EditorSelector.activeLayer(getStore)
    const activeLayerPath = EditorSelector.activeLayerPath(getStore)
    const activeObject = EditorSelector.activeObject(getStore)

    if (
      activeLayer?.layerType !== 'vector' ||
      !activeLayerPath ||
      !activeObject
    )
      return

    execute(
      EditorOps.runCommand,
      new PapCommands.VectorLayer.ReorderObjects({
        pathToTargetLayer: activeLayerPath,
        objectUid: activeObject.uid,
        newIndex: { delta: -1 },
      })
    )
  })

  useFunkyGlobalMouseTrap(['command+down', 'ctrl+down'], (e) => {
    const activeLayer = EditorSelector.activeLayer(getStore)
    const activeLayerPath = EditorSelector.activeLayerPath(getStore)
    const activeObject = EditorSelector.activeObject(getStore)

    if (
      activeLayer?.layerType !== 'vector' ||
      !activeLayerPath ||
      !activeObject
    )
      return

    execute(
      EditorOps.runCommand,
      new PapCommands.VectorLayer.ReorderObjects({
        pathToTargetLayer: activeLayerPath,
        objectUid: activeObject.uid,
        newIndex: { delta: 1 },
      })
    )
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
      new PapCommands.VectorLayer.PatchObjectAttr({
        objectUid: o.uid,
        pathToTargetLayer: path,
        patcher: (attr) => {
          if (target === 'fill') attr.fill = null
          else attr.brush = null
        },
      })
    )
  })

  useFunkyGlobalMouseTrap(['shift+x'], () => {
    executeOperation(EditorOps.updateActiveObject, (o) => {
      swapObjectBrushAndFill(o, { fallbackBrushId: PapBrushes.Brush.id })
    })
  })

  useClickAway(sidebarRef, (e) => {
    if (!isNarrowMedia) return
    if (isEventIgnoringTarget(e.target)) return

    sidebarToggle(false)
  })

  // Initialize Paplico
  useAsyncEffect(async () => {
    ;(window as any).engine = engine.current = new Paplico(canvasRef.current!)
    await engine.current.brushes.register(ExtraBrushes.ScatterBrush)

    console.log('hey')

    executeOperation(EditorOps.initEngine, engine.current)

    Object.defineProperty(window, '_session', {
      configurable: true,
      get() {
        return getStore(EditorStore).state.session
      },
    })

    bindDevToolAPI(getStore)

    if (process.env.NODE_ENV !== 'development') {
    } else {
      const document = Document.createDocument({ width: 1000, height: 1000 })
      const vector = Document.createVectorLayerEntity({})

      canvasRef.current!.width = 1000
      canvasRef.current!.height = 1000

      vector.objects.push(
        Document.createVectorObject({
          appearances: [
            {
              kind: 'fill',
              fill: {
                type: 'fill',
                color: { r: 1, g: 0, b: 0 },
                opacity: 1,
              },
            },
          ],
          path: Document.createVectorPath({
            closed: true,
            points: [
              { x: 0, y: 0, in: null, out: null },
              { x: 100, y: 0, in: null, out: null },
              { x: 100, y: 100, in: null, out: null },
              { x: 0, y: 100, in: null, out: null },
            ],
          }),
        })
      )

      const layers = [
        Document.createRasterLayerEntity({ width: 1000, height: 1000 }),
        Document.createRasterLayerEntity({ width: 1000, height: 1000 }),
        Document.createRasterLayerEntity({ width: 1000, height: 1000 }),
        Document.createRasterLayerEntity({ width: 1000, height: 1000 }),
        Document.createRasterLayerEntity({ width: 1000, height: 1000 }),
        Document.createRasterLayerEntity({ width: 1000, height: 1000 }),
        vector,
      ]

      document.layerEntities.push(...layers)
      document.layerTree = [
        { layerUid: layers[0].uid, children: [] },
        { layerUid: layers[1].uid, children: [] },
        { layerUid: layers[2].uid, children: [] },
        { layerUid: layers[3].uid, children: [] },
        { layerUid: layers[4].uid, children: [] },
        { layerUid: layers[5].uid, children: [] },
        { layerUid: layers[6].uid, children: [] },
      ]

      engine.current.strokeSetting = {
        brushId: ExtraBrushes.ScatterBrush.id,
        brushVersion: '1.0.0',
        size: 5,
        color: { r: 0, g: 0, b: 0 },
        opacity: 1,
        specific: {
          rotationAdjust: 1,
          scatterRange: 3,
        } satisfies ExtraBrushes.ScatterBrush.SpecificSetting,
      }
      engine.current.loadDocument(document)
      engine.current.enterLayer([layers[0].uid])

      // if (EditorSelector.currentDocument(getStore) != null) return

      // const document = Document.createDocument()
      // // ({ width: 1000, height: 1000 })
      // executeOperation(EditorOps.createSession, document)

      // const layer = Document.createRasterLayerEntity({
      //   width: 1000,
      //   height: 1000,
      // })
      // const vector = Document.createVectorLayerEntity({ visible: true })

      // {
      //   const path = Document.createVectorPath({
      //     points: [
      //       { x: 0, y: 0, in: null, out: null },
      //       { x: 200, y: 500, in: null, out: null },
      //       { x: 600, y: 500, in: null, out: null },
      //       {
      //         x: 1000,
      //         y: 1000,
      //         in: null,
      //         out: null,
      //       },
      //     ],
      //     closed: true,
      //   })

      //   const obj = Document.createVectorObject({ x: 0, y: 0, path })

      //   obj.appearances.push({
      //     kind: 'stroke',
      //     stroke: {
      //       brushId: ExtraBrushes.ScatterBrush.id,
      //       color: { r: 0, g: 0, b: 0 },
      //       opacity: 1,
      //       size: 2,
      //     },
      //   })

      //   // obj.fill = null
      //   // obj.fill = {
      //   //   type: 'linear-gradient',
      //   //   opacity: 1,
      //   //   start: { x: -100, y: -100 },
      //   //   end: { x: 100, y: 100 },
      //   //   colorStops: [
      //   //     { color: { r: 0, g: 1, b: 1, a: 1 }, position: 0 },
      //   //     { color: { r: 1, g: 0.2, b: 0.1, a: 1 }, position: 1 },
      //   //   ],
      //   // }

      //   vector.objects.push(obj)
      // }

      // const filter = Document.createFilterLayerEntity({
      //   filters: [],
      // })

      // // const text = PapDOM.TextLayer.create({})
      // // const filter = PapDOM.FilterLayer.create({})
      // // const group = PapDOM.GroupLayer.create({
      // //   layers: [
      // //     PapDOM.RasterLayer.create({ width: 1000, height: 1000 }),
      // //     PapDOM.VectorLayer.create({}),
      // //   ],
      // // })

      // // const reference = PapDOM.ReferenceLayer.create({
      // //   referencedLayerId: layer.uid,
      // // })
      // // reference.x = 20

      // // vector.filters
      // //   .push
      // // PapDOM.Filter.create({
      // //   filterId: '@silk-core/gauss-blur',
      // //   visible: true,
      // //   settings: engine.current.toolRegistry.getFilterInstance(
      // //     '@silk-core/gauss-blur'
      // //   )!.initialConfig,
      // // }),
      // // PapDOM.Filter.create({
      // //   filterId: '@silk-core/chromatic-aberration',
      // //   visible: true,
      // //   settings: engine.current.toolRegistry.getFilterInstance(
      // //     '@silk-core/chromatic-aberration'
      // //   )!.initialConfig,
      // // }),
      // // PapDOM.Filter.create({
      // //   filterId: '@silk-core/noise',
      // //   visible: true,
      // //   settings:
      // //     engine.current.toolRegistry.getFilterInstance('@silk-core/noise')!
      // //       .initialConfig,
      // // }),
      // // PapDOM.Filter.create({
      // //   filterId: '@silk-core/binarization',
      // //   visible: true,
      // //   settings: engine.current.toolRegistry.getFilterInstance(
      // //     '@silk-core/binarization'
      // //   )!.initialConfig,
      // // }),
      // // PapDOM.Filter.create({
      // //   filterId: '@silk-core/low-reso',
      // //   visible: true,
      // //   settings: engine.current.toolRegistry.getFilterInstance(
      // //     '@silk-core/low-reso'
      // //   )!.initialConfig,
      // // })
      // // ()

      // document.layerEntities.push(layer)
      // document.layerEntities.push(vector)
      // // document.layerEntities.push(text)
      // document.layerEntities.push(filter)
      // // document.layerEntities.push(group)
      // // document.layerEntities.unshift(reference)
      // document.layerTree = [
      //   { layerUid: layer.uid, children: [] },
      //   { layerUid: vector.uid, children: [] },
      //   { layerUid: filter.uid, children: [] },
      // ]

      // executeOperation(EditorOps.createSession, document)
      // executeOperation(EditorOps.setActiveLayer, [vector.uid])

      executeOperation(EditorOps.setVectorFill, {
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
    executeOperation(EditorOps.rerenderCanvas)

    return () => {
      window
      console.log('disposed')
      engine.current!.dispose()
    }
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
        }, Canvas holdings ${byteToMiB(
          CanvasFactory.getCanvasBytes()
        )} MiB with ${CanvasFactory.activeCanvasesCount()} canvases
        `
      )
    }
  }, 4000)

  useEffect(() => {
    if (!currentDocument) return
    if (isiOS) {
      execute(NotifyOps.create, {
        area: 'save',
        messageKey: 'exports.autoSaveDisabledInIOS',
        timeout: 5000,
      })

      return
    }

    const autoSave = () => {
      executeOperation(EditorOps.autoSave, currentDocument!.uid)
      executeOperation(NotifyOps.create, {
        area: 'save',
        messageKey: t('exports.autoSaved'),
        timeout: 3000,
      })
    }

    const id = window.setInterval(autoSave, 10000)
    autoSave()

    return () => window.clearInterval(id)
  }, [currentDocument?.uid])

  useWhiteNoise()

  return (
    <PaplicoEngineProvider value={engine.current}>
      <PaintCanvasContext.Provider value={canvasRef}>
        {/* {process.env.NODE_ENV === 'development' && <Testing />} */}
        <div
          ref={rootRef}
          css={css`
            display: flex;
            width: 100%;
            height: 100%;
            flex-flow: column;
            background-color: ${({ theme }) => theme.color.background1};
            color: ${({ theme }) => theme.color.text2};
            touch-action: none;
          `}
          {...bindDrop}
        >
          <div
            css={css`
              @media all and (display-mode: standalone) {
                width: 100%;
                padding-top: 20px;
                background-color: ${({ theme }) => theme.colors.black60};
              }
            `}
            style={{ display: isIpadOS ? 'block' : 'none' }}
          />

          <div
            css={`
              position: relative;
              display: flex;
              flex-flow: row;
              width: 100%;
              height: 100%;
              flex: 1;
            `}
          >
            <ReferenceImageWindow />

            <CanvasPreviewWindow stream={stream} />

            <>
              <div
                css={`
                  position: relative;
                  ${media.narrow`
                display: none;
              `}
                `}
                ref={sidebarRef}
              >
                <Sidebar
                  style={{
                    width: sidebarOpened ? 220 : 32,
                  }}
                  closed={!sidebarOpened}
                  side="left"
                >
                  <div
                    css={`
                      display: flex;
                      flex-flow: column;
                      flex: 1;
                      /* width: 200px; */
                      height: 100%;
                      padding-bottom: env(safe-area-inset-bottom);
                    `}
                  >
                    <LayerView />

                    <FilterView />
                  </div>
                </Sidebar>
                <div
                  css={`
                    position: absolute;
                    bottom: 0;
                    display: flex;
                    padding: 8px;
                    margin-top: auto;
                  `}
                >
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
            </>

            <EditorArea ref={combineRef(editAreaRef)} canvasRef={canvasRef} />

            <>
              <Sidebar
                css={`
                  ${media.narrow`
                  display: none;
                `}
                `}
                style={{
                  width: sidebarOpened ? 220 : 32,
                }}
                closed={!sidebarOpened}
                side="right"
              >
                <ColorHistoryPane />

                <BrushPresets />

                <div
                  css={`
                    display: flex;
                    flex-flow: column;
                    margin-top: auto;
                    /* flex: none; */
                    /* width: 200px; */
                  `}
                >
                  {/*
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
                </div> */}

                  <div
                    css={css`
                      display: flex;
                      flex: none;
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
                          {t(saveMessage?.messageKey)}
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
                            <div onClick={handleClickExportAsPsd}>
                              PSDで書き出し
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
        </div>
      </PaintCanvasContext.Provider>
    </PaplicoEngineProvider>
  )
})

const EditorArea = memo(
  forwardRef<
    HTMLDivElement,
    { canvasRef: MutableRefObject<HTMLCanvasElement | null> }
  >(function EditorArea({ canvasRef }) {
    const theme = useTheme()
    const { execute, getStore } = useFleur()

    const { currentTool } = useStore((get) => ({
      currentTool: get(EditorStore).state.currentTool,
    }))

    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
      null
    )

    const editAreaRef = useRef<HTMLDivElement | null>(null)
    const editorBound = useMeasure(editAreaRef)

    const handleEditAreaPointerDown = useEvent((e: PointerEvent) => {
      const box = editAreaRef.current!.getBoundingClientRect()
      setCursorPos({
        x: e.clientX - box.left,
        y: e.clientY - box.top,
      })
    })

    const handleEditAreaPointerMove = useEvent((e: PointerEvent) => {
      const box = editAreaRef.current!.getBoundingClientRect()

      setCursorPos((prev) =>
        prev
          ? {
              x: e.clientX - box.left,
              y: e.clientY - box.top,
            }
          : null
      )
    })

    const handleEditAreaPointerUp = useEvent(() => {
      setTimeout(() => {
        setCursorPos(null)
      }, 100)
    })

    const editorMultiTouchRef = useMultiFingerTouch((e) => {
      if (e.fingers == 2) execute(EditorOps.undoCommand)
      if (e.fingers == 3) execute(EditorOps.redoCommand)
    })

    useGesture(
      {
        onPinch: ({ delta: [d, r] }) => {
          execute(EditorOps.setCanvasTransform, {
            scale: (prev) => Math.max(0.1, prev + d / 400),
          })
        },

        onDrag: (e) => {
          if (e.touches < 2) return

          execute(EditorOps.setCanvasTransform, {
            pos: ({ x, y }) => ({
              x: x + e.delta[0],
              y: y + e.delta[1],
            }),
          })
        },
      },
      { domTarget: editAreaRef, eventOptions: { passive: false } }
    )

    useEffect(() => {
      const handleCanvasWheel = (e: WheelEvent) => {
        if (DOMUtils.closestOrSelf(e.target, '[data-ignore-canvas-wheel]'))
          return

        e.preventDefault()

        execute(EditorOps.setCanvasTransform, {
          pos: ({ x, y }) => ({
            x: x - e.deltaX * 0.5,
            y: y - e.deltaY * 0.5,
          }),
        })
      }

      editAreaRef.current?.addEventListener('wheel', handleCanvasWheel, {
        passive: false,
      })

      return () =>
        editAreaRef.current?.removeEventListener('wheel', handleCanvasWheel)
    }, [])

    return (
      <div
        ref={combineRef(editAreaRef, editorMultiTouchRef)}
        css={css`
          position: relative;
          display: flex;
          flex: 1;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background-color: ${rgba('#11111A', 0.3)};
          /** disable magnifying grass in iOS */
          user-select: none;
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
        onPointerDown={handleEditAreaPointerDown}
        onPointerMove={handleEditAreaPointerMove}
        onPointerUp={handleEditAreaPointerUp}
        onContextMenu={DOMUtils.preventDefaultHandler}
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
            // ...(dragState.over ? { opacity: 1 } : { opacity: 0 }),
            opacity: 0,
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
            width: 6px;
            height: 6px;
            border: 1px solid #fff;
            opacity: 0;
            box-shadow: inset 0 0 0 0.5px #000, 0 0 0 0.5px #000;
            border-radius: 4px;

            transition: 0.15s ease-in-out;
            transition-property: opacity, transform;
          `}
          style={{
            left: cursorPos?.x ?? 0,
            top: cursorPos?.y ?? 0,
            opacity: cursorPos ? 1 : 0,
            transform: cursorPos
              ? 'translate(-50%, -50%) scale(1)'
              : 'translate(-50%, -50%) scale(2)',
          }}
        />

        <div
          css={`
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
          `}
          id="canvas-overlays"
        />

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

        <div
          css={`
            position: absolute;
            top: 16px;
            left: 50%;
            z-index: 10;
            padding-top: env(safe-area-inset-bottom, 16px);
            transform: translateX(-50%);
          `}
        >
          <HistoryFlash />
        </div>
      </div>
    )
  })
)

const PaintCanvas = memo(function PaintCanvas({
  canvasRef,
}: {
  canvasRef: RefObject<HTMLCanvasElement>
}) {
  const canvasHandler = useRef<CanvasHandler | null>(null)

  const { execute, getStore } = useFleur()
  const {
    currentDocument,
    session,
    engine,
    currentTool,
    renderStrategy,
    scale,
    pos,
  } = useStore((get) => ({
    currentDocument: EditorSelector.currentDocument(get),
    currentTool: EditorSelector.currentTool(get),
    session: get(EditorStore).state.session,
    engine: get(EditorStore).state.engine,
    renderStrategy: get(EditorStore).state.renderStrategy,
    scale: get(EditorStore).state.canvasScale,
    pos: get(EditorStore).state.canvasPosition,
  }))

  const [play, { sound, stop }] = useSound(
    require('./sounds/assets/Mechanical_Pen01-05(Straight).mp3'),
    { volume: 0.2 }
  )

  const handleClickCanvas = useEvent(
    ({
      currentTarget,
      clientX,
      clientY,
      buttons,
    }: PointerEvent<HTMLCanvasElement>) => {
      if (buttons !== 1 || currentTool !== 'dropper') return

      const rect = currentTarget.getBoundingClientRect()
      const [x, y] = [
        (clientX - rect.left) / scale,
        (clientY - rect.top) / scale,
      ]

      const ctx = canvasRef.current!.getContext('2d')!
      const pixel = ctx.getImageData(x, y, 1, 1)

      // const data = ctx.createImageData(1, 1)
      // data.data.set([255, 0, 0, 255])
      // canvasRef.current!.getContext('2d')!.putImageData(data, x, y)

      execute(EditorOps.setBrushSetting, {
        color: {
          r: pixel.data[0] / 255,
          g: pixel.data[1] / 255,
          b: pixel.data[2] / 255,
        },
      })
    }
  )

  const measure = useMeasure(canvasRef)

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
          ${checkerBoard({ size: 24, opacity: 0.1 })}
          box-shadow: 0 0 16px rgba(0, 0, 0, 0.1);
          /** disable magnifying grass in iOS */
          user-select: none;
        `}
        data-is-paint-canvas="yup"
        ref={canvasRef}
        onPointerMove={handleClickCanvas}
      />
    </div>
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

const ColorHistoryPane = memo(function ColorHistoryPane() {
  const { t } = useTranslation('app')
  const { execute, getStore } = useFleur()

  const colorHistory = useStore(EditorSelector.colorHistory)

  const handleClickColor = useEvent(({ currentTarget }) => {
    const id = currentTarget.dataset.id!
    const entry = colorHistory.find((entry) => entry.id === id)
    if (!entry) return

    const activeLayer = EditorSelector.activeLayer(getStore)

    if (activeLayer?.layerType === 'vector') {
      const vectorColorTarget = EditorSelector.vectorColorTarget(getStore)
      const pathToActiveLayer = EditorSelector.activeLayerPath(getStore)
      const defaultVectorBrush = EditorSelector.defaultVectorBrush(getStore)
      const activeObject = EditorSelector.activeObject(getStore)

      if (!activeObject) return

      if (vectorColorTarget === 'fill') {
        execute(EditorOps.setVectorFill, { color: entry.color })
      } else if (vectorColorTarget === 'stroke') {
        execute(EditorOps.setBrushSetting, { color: entry.color })
      }

      execute(
        EditorOps.runCommand,
        new PapCommands.VectorLayer.PatchObjectAttr({
          pathToTargetLayer: pathToActiveLayer!,
          objectUid: activeObject.uid,
          patcher: (attrs) => {
            if (vectorColorTarget === 'stroke') {
              attrs.brush = attrs.brush
                ? { ...attrs.brush, color: entry.color }
                : {
                    ...defaultVectorBrush,
                    color: entry.color,
                  }
            } else if (
              vectorColorTarget === 'fill' &&
              attrs.fill?.type === 'fill'
            ) {
              attrs.fill.color = entry.color
            }
          },
        })
      )
    } else {
      execute(EditorOps.setBrushSetting, { color: entry.color })
    }
  })

  return (
    <SidebarPane
      css={`
        max-height: 200px;
      `}
      heading={t('colorHistory')}
    >
      <div
        css={`
          display: grid;
          gap: 4px;
          grid-template-columns: repeat(auto-fill, minmax(24px, 1fr));
        `}
      >
        {colorHistory.map((entry) => (
          <>
            <div
              css={`
                width: 100%;
                &::before {
                  content: '';
                  display: block;
                  padding-top: 100%;
                }
              `}
              style={{
                backgroundColor: rgba(...normalRgbToRgbArray(entry.color), 1),
              }}
              data-id={entry.id}
              onClick={handleClickColor}
            />
          </>
        ))}
      </div>
    </SidebarPane>
  )
})

const byteToMiB = (byte: number) => Math.round((byte / 1024 / 1024) * 100) / 100

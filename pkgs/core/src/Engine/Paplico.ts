import immer, { Draft } from 'immer'
import { RenderPipeline } from '@/Engine/RenderPipeline'
import { BrushRegistry } from '@/Engine/Registry/BrushRegistry'
import {
  createCanvas,
  createContext2D,
  getCanvasBytes,
} from '@/Engine/CanvasFactory'
import { VectorObjectOverrides, VectorRenderer } from '@/Engine/VectorRenderer'
import { UICanvas } from '@/UI/UICanvas'
import { UIStroke } from '@/UI/UIStroke'
import {
  createDocument,
  createRasterLayerEntity,
  createVectorObject,
  LayerEntity,
  PaplicoDocument,
  VectorObject,
  VectorPath,
} from '../Document'
import {
  clearCanvas,
  freeingCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { DocumentContext } from './DocumentContext'
import { VectorStrokeSetting } from '../Document/LayerEntity/VectorStrokeSetting'
import { VectorFillSetting } from '../Document/LayerEntity/VectorFillSetting'
import { InkSetting as _InkSetting } from '../Document/LayerEntity/InkSetting'
import { deepClone } from '../utils/object'
import { VectorAppearance } from '../Document/LayerEntity/VectorAppearance'
import { CircleBrush } from '../Brushes/CircleBrush'
import { Emitter } from '../utils/Emitter'
import { BrushClass } from './Brush/Brush'
import { RenderCycleLogger } from './RenderCycleLogger'
import { PlainInk } from '../Inks/PlainInk'
import { InkRegistry } from './Registry/InkRegistry'
import { RainbowInk } from '../Inks/RainbowInk'
import { TextureReadInk } from '../Inks/TextureReadInk'
import { AtomicResource } from '../utils/AtomicResource'
import { PaplicoAbortError, PaplicoIgnoreableError } from '../Errors'
import { ICommand } from '@/History/ICommand'
import * as Commands from '@/History/Commands'
import { RenderQueue } from '../utils/AsyncQueue'
import { AppearanceRegistry } from '@/Engine/Registry/AppearanceRegistry'
import { SVGExporter } from './Exporters/SVGExporter'
import { PNGExporter } from './Exporters/PNGExporter'
import { IExporter } from './Exporters/IExporter'
import { PSDExporter } from './Exporters/PSDExporter'
import { type History } from '@/History/History'
import { PreviewStore } from './PreviewStore'
import { logImage } from '../utils/DebugHelper'
import {
  NoneImpls,
  type PaneSetState,
  type PaplicoComponents,
} from '@/UI/PaneUI/index'
import { type AbstractComponentRenderer } from '../UI/PaneUI/AbstractComponent'
import { TestFilter } from '../Filters'
import { WebGLRenderer } from 'three'
import { PaneUIRenderings } from './PaneUIRenderings'
import { FontRegistry } from './Registry/FontRegistry'
import { rescue } from '@/utils/resque'

export namespace Paplico {
  export type StrokeSetting<T extends Record<string, any> = any> =
    VectorStrokeSetting<T>

  export type FillSetting = VectorFillSetting

  export type InkSetting = _InkSetting

  export type Preferences = {
    /** Simplify path tolerance, recommend to 0 to 6. 0 is no simplify */
    strokeTrelance: number
  }

  export type ActiveLayer = {
    layerType: LayerEntity['layerType']
    layerUid: string
    pathToLayer: string[]
  }

  export type State = {
    activeLayer: ActiveLayer | null
    currentStroke: StrokeSetting | null
    currentFill: FillSetting | null
    currentInk: InkSetting
    strokeComposition: 'normal' | 'erase'
    brushEntries: BrushClass[]
    busy: boolean
  }

  export type StrokeEvent = {
    stroke: UIStroke
    defaultPrevented: boolean
    preventDefault: () => void
  }

  export type Events = {
    stateChanged: Paplico.State
    documentChanged: {
      previous: PaplicoDocument | null
      current: PaplicoDocument | null
    }
    activeLayerChanged: { current: Paplico.ActiveLayer | null }
    flushed: void

    strokeStarted: StrokeEvent
    strokePreChange: StrokeEvent
    strokePreComplete: StrokeEvent
    strokeCancelled: StrokeEvent

    'preview:updated': PreviewStore.Events['updated']
    'history:affect': History.Events['affect']
    'document:layerUpdated': { layerEntityUid: string }
  }

  export type RenderOptions = {
    layerOverrides?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
    vectorObjectOverrides?: VectorObjectOverrides
    destination?: CanvasRenderingContext2D
    pixelRatio?: number
    signal?: AbortSignal
  }

  export type _PaneImpl = {
    components: PaplicoComponents
    h: AbstractComponentRenderer
  }
}

const DEFAULT_FILL_SETTING = (): Readonly<Paplico.FillSetting> => ({
  type: 'fill',
  color: {
    r: 0,
    g: 0,
    b: 0,
  },
  opacity: 1,
})

const DEFAULT_STROKE_SETTING = (): Readonly<Paplico.StrokeSetting> => ({
  brushId: CircleBrush.metadata.id,
  brushVersion: CircleBrush.metadata.version,
  color: {
    r: 0,
    g: 0,
    b: 0,
  },
  opacity: 1,
  size: 10,
  specific: {},
})

export class Paplico extends Emitter<Paplico.Events> {
  public readonly brushes: BrushRegistry
  public readonly inks: InkRegistry
  public readonly filters: AppearanceRegistry
  public readonly fonts: FontRegistry

  public readonly pipeline: RenderPipeline
  public readonly vectorRenderer: VectorRenderer
  public readonly uiCanvas: UICanvas
  public readonly paneUI: PaneUIRenderings

  protected readonly dstCanvas: HTMLCanvasElement
  protected readonly dstctx: CanvasRenderingContext2D
  protected readonly glRendererResource: AtomicResource<WebGLRenderer>

  protected document: PaplicoDocument | null = null
  protected runtimeDoc: DocumentContext | null = null

  protected beforeCommitAborter: AbortController = new AbortController()
  protected readonly tmpctxResource: AtomicResource<CanvasRenderingContext2D>
  protected readonly strokingCtxResource: AtomicResource<CanvasRenderingContext2D>

  protected readonly rerenderQueue = new RenderQueue<'previewRender'>()
  protected activeStrokeChangeAborters: AbortController[] = []

  protected idleRerenderTimerId: any

  protected readonly paneImpl: Paplico._PaneImpl

  #preferences: Paplico.Preferences = {
    strokeTrelance: 5,
  }

  #state: Paplico.State = {
    activeLayer: null,
    currentStroke: null,
    currentFill: null,
    currentInk: {
      inkId: RainbowInk.id,
      inkVersion: RainbowInk.version,
      specific: {},
    },
    strokeComposition: 'normal',
    brushEntries: [],
    busy: false,
  }

  #activeLayerEntity: LayerEntity | null = null

  public static createWithDocument(
    canvas: HTMLCanvasElement,
    opt: { width: number; height: number },
  ) {
    const pap = new Paplico(canvas)

    const doc = createDocument({ width: opt.width, height: opt.height })
    const layer = createRasterLayerEntity({
      width: opt.width,
      height: opt.height,
    })

    doc.layerEntities.push(layer)
    doc.layerTree.children.push({
      layerUid: layer.uid,
      children: [],
    })

    pap.loadDocument(doc)
    pap.setStrokingTargetLayer([layer.uid])

    return pap
  }

  constructor(
    canvas: HTMLCanvasElement,
    opts: {
      paneComponentImpls?: PaplicoComponents
      paneCreateElement?: AbstractComponentRenderer
    } = {},
  ) {
    super()

    this.paneImpl = {
      components: opts.paneComponentImpls ?? NoneImpls,
      h: opts.paneCreateElement ?? (() => null),
    }

    this.brushes = new BrushRegistry()
    this.brushes.register(CircleBrush)

    this.inks = new InkRegistry()
    this.inks.register(PlainInk)
    this.inks.register(RainbowInk)
    this.inks.register(TextureReadInk)

    this.filters = new AppearanceRegistry()
    this.filters.register(TestFilter)

    this.fonts = new FontRegistry()

    const renderer = new WebGLRenderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      canvas: createCanvas() as HTMLCanvasElement,
    })
    renderer.setClearColor(0xffffff, 0)
    this.glRendererResource = new AtomicResource(renderer, 'Paplico#glRenderer')

    this.pipeline = new RenderPipeline({
      filterRegistry: this.filters,
      glRenderer: this.glRendererResource,
    })
    this.vectorRenderer = new VectorRenderer({
      brushRegistry: this.brushes,
      inkRegistry: this.inks,
      appearanceRegistry: this.filters,
      fontRegistry: this.fonts,
      glRenderer: this.glRendererResource,
    })
    this.uiCanvas = new UICanvas(canvas).activate()
    this.paneUI = new PaneUIRenderings({
      paplico: this,
      brushRegistry: this.brushes,
      filterRegistry: this.filters,
      paneImpl: this.paneImpl,
    })

    this.dstCanvas = canvas
    this.dstctx = canvas.getContext('2d')!

    this.tmpctxResource = new AtomicResource(
      createContext2D({
        willReadFrequently: true,
        colorSpace: 'display-p3',
      }),
      'Paplico#tmpctx',
    )

    this.strokingCtxResource = new AtomicResource(
      createContext2D({
        colorSpace: 'display-p3',
      }),
      'Paplico#strokingCtx',
    )

    this.onUIStrokeChange = this.onUIStrokeChange.bind(this)
    this.onUIStrokeComplete = this.onUIStrokeComplete.bind(this)

    this.initialize()
  }

  public get stats() {
    return { getCanvasBytes }
  }

  /** (Readonly) current editor states */
  public get state() {
    return this.#state
  }

  public get currentDocument() {
    return this.document
  }

  protected setState(
    fn: (draft: Draft<Paplico.State>) => void,
    { skipEmit = false }: { skipEmit?: boolean } = {},
  ) {
    this.#state = immer(this.#state, (d) => {
      fn(d)
    })

    if (!skipEmit) {
      this.emit('stateChanged', this.#state)
    }
  }

  private get activeLayerEntity(): LayerEntity | null {
    return this.#activeLayerEntity
  }

  protected initialize() {
    this.brushes.on('entriesChanged', () => {
      this.setState((d) => {
        d.brushEntries = this.brushes.brushEntries
      })
    })

    this.uiCanvas.on('strokeStart', (stroke) => {
      this.emit('strokeStarted', createStrokeEvent(stroke))
    })

    this.uiCanvas.on('strokeChange', (stroke) => {
      // #region emit strokePreChange and check preventing by user
      const strokeEvent = createStrokeEvent(stroke)
      this.emit('strokePreChange', strokeEvent)
      if (strokeEvent.defaultPrevented) return
      // #endregion

      this.onUIStrokeChange(stroke)
    })

    this.uiCanvas.on('strokeComplete', (stroke) => {
      // #region emit strokePreChange and check preventing by user
      const strokeEvent = createStrokeEvent(stroke)
      this.emit('strokePreComplete', strokeEvent)
      if (strokeEvent.defaultPrevented) return
      // #endregion

      this.onUIStrokeComplete(stroke)
    })

    this.uiCanvas.on('strokeCancel', (stroke) => {
      this.rerender()
      this.emit('strokeCancelled', createStrokeEvent(stroke))
    })

    this.setState((d) => {
      d.brushEntries = this.brushes.brushEntries
    })
  }

  public dispose() {
    this.mitt.all.clear()

    this.tmpctxResource.clearQueue()
    freeingCanvas(this.tmpctxResource.ensureForce().canvas)

    this.uiCanvas.dispose()
    this.runtimeDoc?.dispose()
    this.vectorRenderer.dispose()
    this.pipeline.dispose()

    this.glRendererResource.clearQueue()
    this.glRendererResource.ensureForce().dispose()
  }

  public readonly previews = {
    entries: () => {
      return this.runtimeDoc?.previews.entries() ?? []
    },
    getForLayer: (layerUid: string) => {
      return this.runtimeDoc?.getPreviewImage(layerUid)
    },
  }

  protected export(
    exporter: IExporter,
    options: IExporter.OptionsToRequest<IExporter.Options>,
  ) {
    if (!this.runtimeDoc) {
      throw new Error(`Paplico.export: No document loaded`)
    }

    // SEE: https://html.spec.whatwg.org/multipage/canvas.html#serialising-bitmaps-to-a-file
    const dpi = options.dpi ?? 96
    const pixelRatio = dpi / 96

    return exporter.export(
      { paplico: this, runtimeDocument: this.runtimeDoc },
      { ...options, pixelRatio, dpi },
    )
  }

  public readonly exporters = {
    svg: (
      options: Partial<IExporter.OptionsToRequest<SVGExporter.Options>>,
    ) => {
      return this.export(new SVGExporter(), {
        looseSVGOriginalStrict: false,
        targetNodePath: undefined,
        ...options,
      })
    },
    png: (
      options: Partial<IExporter.OptionsToRequest<PNGExporter.Options>>,
    ) => {
      return this.export(new PNGExporter(), {
        targetNodePath: undefined,
        ...options,
      })
    },
    psd: (
      options: Partial<IExporter.OptionsToRequest<PSDExporter.Options>>,
    ) => {
      return this.export(new PSDExporter(), {
        targetNodePath: undefined,
        ...options,
      })
    },
    customFormat: (
      exporter: IExporter,
      options: IExporter.OptionsToRequest<IExporter.Options>,
    ) => {
      return this.export(exporter, options)
    },
  }

  public readonly command = {
    do: (command: ICommand) => this.runtimeDoc?.command.do(command),
    undo: () => this.runtimeDoc?.command.undo(),
    redo: () => this.runtimeDoc?.command.redo(),
    canUndo: () => this.runtimeDoc?.command.canUndo() ?? false,
    canRedo: () => this.runtimeDoc?.command.canRedo() ?? false,
  }

  public loadDocument(doc: PaplicoDocument | null) {
    const prevDocument = this.document

    this.#activeLayerEntity = null
    this.runtimeDoc?.dispose()

    if (doc == null) {
      this.document = null
      this.runtimeDoc = null
      this.emit('documentChanged', {
        current: null,
        previous: prevDocument,
      })

      return
    }

    this.document = doc
    this.runtimeDoc = new DocumentContext(doc)
    this.runtimeDoc.previews.on('updated', (updateEntry) => {
      this.emit('preview:updated', updateEntry)
    })

    this.runtimeDoc.history.on('affect', (e) => {
      this.rerenderForHistoryAffection()

      rescue(() => {
        e.layerIds.forEach((layerEntityUid) => {
          this.emit('document:layerUpdated', { layerEntityUid })
        })
      })

      rescue(() => {
        this.emit('history:affect', e)
      })
    })

    doc.blobs.forEach((blob) => {
      this.runtimeDoc?.setBlobCache(
        blob.uid,
        new Blob([blob.data], { type: blob.mimeType }),
      )
    })

    this.emit('documentChanged', {
      previous: prevDocument,
      current: doc,
    })
  }

  public setStrokingTargetLayer(path: string[]) {
    if (!this.document) {
      console.log('Paplico.enterLayer: No document loaded')
      return
    }

    if (path.length === 0) {
      this.setState((d) => {
        d.activeLayer = null
      })

      this.emit('activeLayerChanged', { current: null })
      return
    }

    const target = this.document.resolveNodePath(path)
    if (!target) {
      console.warn(`Paplico.enterLayer: Layer not found: ${path.join('/')}`)
      return
    }

    const layer = this.document.resolveLayerEntity(target.layerUid)!

    this.setState((d) => {
      d.activeLayer = {
        layerType: layer.layerType,
        layerUid: target!.layerUid,
        pathToLayer: path,
      }

      this.#activeLayerEntity = layer
    })

    console.info(`Enter layer: ${path.join('/')}`)
    this.emit('activeLayerChanged', { current: this.#state.activeLayer })
  }

  public getStrokeSetting(): Paplico.StrokeSetting | null {
    return this.#state.currentStroke
  }

  public setStrokeSetting(setting: Partial<Paplico.StrokeSetting> | null) {
    this.setState((d) => {
      if (!setting) d.currentStroke = null
      else
        d.currentStroke = {
          ...DEFAULT_STROKE_SETTING(),
          ...d.currentStroke,
          ...setting,
        }
    })
  }

  public getFillSetting(): Paplico.FillSetting | null {
    return this.#state.currentFill
  }

  public setFillSetting(setting: Partial<Paplico.FillSetting> | null) {
    return this.setState((d) => {
      if (!setting) d.currentFill = null
      else
        d.currentFill = {
          ...DEFAULT_FILL_SETTING(),
          ...d.currentFill,
          ...setting,
        }
    })
  }

  public getPreferences(): Paplico.Preferences {
    return this.#preferences
  }

  public setPreferences(prefs: Partial<Paplico.Preferences>) {
    this.#preferences = immer(this.#preferences, (d) => {
      Object.assign(d, prefs)
    })
  }

  public setStrokeCompositionMode(
    composition: Paplico.State['strokeComposition'],
  ) {
    this.setState((d) => {
      d.strokeComposition = composition
    })
  }

  public requestIdleRerender(options: Paplico.RenderOptions) {
    // clearTimeout(this.idleRerenderTimerId)

    // const checkIdle = () => {
    //   if (this.rerenderQueue.queueLength('previewRender') === 0) {
    //     this.rerender(options)
    //   } else {
    //     this.idleRerenderTimerId = setTimeout(checkIdle, 1)
    //   }
    // }

    this.rerenderQueue.push(
      'previewRender',
      async () => {
        this.rerender(options)
      },
      { maxQueue: 10 },
    )

    // this.idleRerenderTimerId = setTimeout(checkIdle, 1)
  }

  public async rerender({
    layerOverrides,
    vectorObjectOverrides,
    destination,
    pixelRatio = 1,
    signal,
  }: Paplico.RenderOptions = {}) {
    if (!this.runtimeDoc) return

    const runtimeDoc = this.runtimeDoc
    const updateLock = await runtimeDoc.updaterLock.ensure()
    // -- ^ waiting for previous render commit

    this.beforeCommitAborter?.abort()
    const beforeCommitAborter = (this.beforeCommitAborter =
      new AbortController())

    const combineAborder = new AbortController()
    signal?.addEventListener('abort', () => {
      combineAborder.abort()
    })

    beforeCommitAborter.signal.addEventListener(
      'abort',
      () => {
        combineAborder.abort()
      },
      { signal },
    )

    try {
      RenderCycleLogger.current.log('Refresh all layers')

      const dstctx = destination ?? this.dstctx
      const dstCanvas = dstctx.canvas

      this.setState((d) => (d.busy = true))

      await this.pipeline.fullyRender(dstctx, runtimeDoc, this.vectorRenderer, {
        abort: combineAborder.signal,
        override: layerOverrides,
        vectorObjectOverrides: vectorObjectOverrides,
        pixelRatio,
        viewport: {
          top: 0,
          left: 0,
          width: dstCanvas.width,
          height: dstCanvas.height,
        },
        phase: 'final',
        logger: RenderCycleLogger.current,
      })

      this.emit('flushed')
    } catch (e) {
      if (e instanceof PaplicoIgnoreableError) return
      throw e
    } finally {
      runtimeDoc.updaterLock.release(updateLock)
      this.setState((d) => (d.busy = false))
      RenderCycleLogger.current.printLogs('rerender()')
    }
  }

  /**
   * Execute stroke completion process with specified stroke.
   */
  public async putStrokeComplete(
    stroke: UIStroke,
    {
      targetLayerUid,
      strokeSettings,
    }: { targetLayerUid?: string; strokeSettings?: Paplico.StrokeSetting },
  ) {
    // save current states
    const prev = this.#state.activeLayer
    const prevLayer = this.#activeLayerEntity
    const prevStroke = this.getStrokeSetting()

    // set activeLayer temporary
    if (targetLayerUid) {
      const nextLayer = this.document?.resolveLayerEntity(targetLayerUid)
      const targetPath = this.document?.findLayerNodePath(targetLayerUid)

      if (!nextLayer || !targetPath) {
        throw new Error(`Layer not found: ${targetLayerUid}`)
      }

      this.setState(
        (d) => {
          d.activeLayer = {
            layerType: nextLayer.layerType,
            layerUid: targetLayerUid,
            pathToLayer: targetPath,
          }
        },
        { skipEmit: true },
      )

      this.#activeLayerEntity = nextLayer
    }

    // set strokeSettings temporary
    if (strokeSettings) {
      this.setState(
        (d) => {
          d.currentStroke = strokeSettings
        },
        { skipEmit: true },
      )
    }

    try {
      this.onUIStrokeComplete(stroke)
    } finally {
      // restore states
      this.setState(
        (d) => {
          d.activeLayer = prev
          d.currentStroke = prevStroke
        },
        { skipEmit: true },
      )

      this.#activeLayerEntity = prevLayer
    }
  }

  protected async onUIStrokeChange(stroke: UIStroke): Promise<void> {
    const aborter = new AbortController()
    this.activeStrokeChangeAborters.push(aborter)

    this.rerenderQueue.push(
      'previewRender',
      async () => {
        this.onUIStrokeChangeProcess.call(this, stroke, aborter)
      },
      { maxQueue: 10 },
    )
  }

  protected async onUIStrokeChangeProcess(
    stroke: UIStroke,
    abort?: AbortController,
  ): Promise<void> {
    if (!this.runtimeDoc) return
    if (!this.activeLayerEntity) return
    if (this.#state.busy) return

    const renderLogger = RenderCycleLogger.createNext()

    const aborter = abort ?? new AbortController()

    const runtimeDoc = this.runtimeDoc // Lock reference
    const activeLayerEntity = this.activeLayerEntity // Lock reference
    const currentStroke = this.#state.currentStroke // Lock reference

    const [tmpctx, strkctx] = await Promise.all([
      this.tmpctxResource.ensure(),
      this.strokingCtxResource.ensure(),
    ])

    const dstctx = this.dstctx

    try {
      if (aborter.signal.aborted) {
        throw new PaplicoAbortError()
      }

      // clear first, if clear after render, it will cause visually freeze
      clearCanvas(tmpctx)

      const path = stroke.toPath()

      if (activeLayerEntity.layerType === 'vector') {
        const obj = this.createVectorObjectByCurrentSettings(stroke)

        await this.vectorRenderer.renderVectorLayer(
          tmpctx.canvas,
          {
            ...activeLayerEntity,
            objects: [...activeLayerEntity.objects, obj],
          },
          {
            abort: aborter.signal,
            pixelRatio: 1,
            viewport: {
              top: 0,
              left: 0,
              width: this.dstCanvas.width,
              height: this.dstCanvas.height,
            },
            phase: 'stroking',
            logger: renderLogger,
          },
        )
      } else if (activeLayerEntity.layerType === 'raster') {
        if (!currentStroke) return

        const currentBitmap = (await runtimeDoc.getOrCreateLayerBitmapCache(
          activeLayerEntity.uid,
        ))!

        setCanvasSize(tmpctx.canvas, currentBitmap.width, currentBitmap.height)
        clearCanvas(tmpctx)

        setCanvasSize(strkctx.canvas, currentBitmap.width, currentBitmap.height)
        clearCanvas(strkctx)

        // Copy current layer image to tmpctx
        tmpctx.drawImage(currentBitmap, 0, 0)

        renderLogger.log('render stroke')

        // Write stroke to current layer
        await this.vectorRenderer.renderStroke(
          strkctx.canvas,
          path,
          currentStroke!,
          {
            inkSetting: this.#state.currentInk,
            abort: aborter.signal,
            transform: {
              position: { x: 0, y: 0 },
              scale: { x: 1, y: 1 },
              rotation: 0,
            },
            phase: 'stroking',
            logger: renderLogger,
          },
        )

        saveAndRestoreCanvas(tmpctx, () => {
          tmpctx.globalCompositeOperation =
            this.#state.strokeComposition === 'normal'
              ? 'source-over'
              : 'destination-out'

          tmpctx.drawImage(strkctx.canvas, 0, 0)
        })
      } else {
        return
      }

      // Mix current layer to destination
      // this.pipeline.mix(dstctx, tmpctx, {composition: 'normal'})

      // this.destctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      // this.destctx.drawImage(tmpctx.canvas, 0, 0)

      try {
        if (aborter.signal.aborted) {
          throw new PaplicoAbortError()
        }

        await this.pipeline.fullyRender(
          dstctx,
          this.runtimeDoc,
          this.vectorRenderer,
          {
            override: { [activeLayerEntity.uid]: tmpctx.canvas },
            abort: aborter.signal,
            pixelRatio: 1,
            viewport: {
              top: 0,
              left: 0,
              width: this.dstCanvas.width,
              height: this.dstCanvas.height,
            },
            phase: 'stroking',
            logger: renderLogger,
          },
        )

        this.emit('flushed')
      } finally {
        clearCanvas(tmpctx)
        renderLogger.printLogs('onUIStrokeChange')
      }
    } catch (e) {
      if (!(e instanceof PaplicoIgnoreableError)) {
        throw e
      } else {
        // console.info('ignoreable error', e)
      }
    } finally {
      this.tmpctxResource.release(tmpctx)
      this.strokingCtxResource.release(strkctx)
    }
  }

  protected async onUIStrokeComplete(stroke: UIStroke) {
    if (!this.runtimeDoc) return
    if (!this.activeLayerEntity) return

    RenderCycleLogger.createNext()
    RenderCycleLogger.current.log('start: stroke complete')

    // Cancel all waiting stroke change render queue
    this.activeStrokeChangeAborters.forEach((aborter) => aborter.abort())
    this.activeStrokeChangeAborters = []

    if (this.#state.busy) return

    const runtimeDoc = this.runtimeDoc // Lock reference
    const activeLayerEntity = this.activeLayerEntity // Lock reference
    const currentStroke = this.#state.currentStroke // Lock reference

    const updateLock = await runtimeDoc.updaterLock.ensure()
    // -- ^ waiting for previous render commit

    this.beforeCommitAborter?.abort()
    this.beforeCommitAborter = new AbortController()

    // Not do this, commit is must be completion or failed
    // This aborter is not used
    // const aborter = (this.lastRenderAborter = new AbortController())
    const aborter = new AbortController()

    const [tmpctx, strkctx] = await Promise.all([
      this.tmpctxResource.ensure(),
      this.strokingCtxResource.ensure(),
    ])

    const dstctx = this.dstctx

    this.setState((d) => (d.busy = true))

    try {
      // clear first, if clear after render, it will cause visually freeze
      clearCanvas(tmpctx)

      RenderCycleLogger.current.time('toSimplefiedPath')

      const path = stroke.toSimplifiedPath({
        tolerance: this.#preferences.strokeTrelance,
      })
      // const path = stroke.toPath()
      RenderCycleLogger.current.timeEnd('toSimplefiedPath')
      RenderCycleLogger.current.info(
        `Path simplified: ${stroke.points.length} -> ${path.points.length}`,
      )

      if (activeLayerEntity.layerType === 'vector') {
        const obj = this.createVectorObjectByCurrentSettings(path)

        await this.command.do(
          new Commands.VectorUpdateLayer(activeLayerEntity.uid, {
            updater: (layer) => {
              layer.objects.push(obj)
            },
          }),
        )

        // Update layer image data
        setCanvasSize(
          tmpctx.canvas,
          this.dstCanvas.width,
          this.dstCanvas.height,
        )

        // console.log('draw', activeLayerEntity)

        await this.vectorRenderer.renderVectorLayer(
          tmpctx.canvas,
          activeLayerEntity,
          {
            abort: aborter.signal,
            pixelRatio: 1,
            viewport: {
              top: 0,
              left: 0,
              width: this.dstCanvas.width,
              height: this.dstCanvas.height,
            },
            phase: 'final',
            logger: RenderCycleLogger.current,
          },
        )

        await runtimeDoc.updateOrCreateLayerBitmapCache(
          activeLayerEntity.uid,
          tmpctx.getImageData(0, 0, tmpctx.canvas.width, tmpctx.canvas.height),
        )
      } else if (activeLayerEntity.layerType === 'raster') {
        if (!currentStroke) return

        const currentBitmap = (await runtimeDoc.getOrCreateLayerBitmapCache(
          activeLayerEntity.uid,
        ))!

        setCanvasSize(tmpctx.canvas, currentBitmap.width, currentBitmap.height)
        clearCanvas(tmpctx)

        setCanvasSize(strkctx.canvas, currentBitmap.width, currentBitmap.height)
        clearCanvas(strkctx)

        // Copy current layer image to tmpctx
        tmpctx.drawImage(currentBitmap, 0, 0)

        // Write stroke to current layer
        await this.vectorRenderer.renderStroke(
          strkctx.canvas,
          path,
          currentStroke!,
          {
            inkSetting: this.#state.currentInk,
            abort: aborter.signal,
            transform: {
              position: { x: 0, y: 0 },
              scale: { x: 1, y: 1 },
              rotation: 0,
            },
            phase: 'final',
            logger: RenderCycleLogger.current,
          },
        )

        saveAndRestoreCanvas(tmpctx, () => {
          logImage(tmpctx)
          logImage(strkctx)

          tmpctx.globalCompositeOperation =
            this.#state.strokeComposition === 'normal'
              ? 'source-over'
              : 'destination-out'

          console.log(tmpctx.globalCompositeOperation)
          tmpctx.drawImage(strkctx.canvas, 0, 0)
        })

        // Update layer image data
        await this.command.do(
          new Commands.RasterUpdateBitmap(activeLayerEntity.uid, {
            updater: (bitmap) => {
              bitmap.set(
                tmpctx.getImageData(
                  0,
                  0,
                  currentBitmap.width,
                  currentBitmap.height,
                ).data,
              )
            },
          }),
        )
      } else {
        return
      }

      try {
        RenderCycleLogger.current.log('Refresh all layers')

        await this.pipeline.fullyRender(
          dstctx,
          runtimeDoc,
          this.vectorRenderer,
          {
            // abort: aborter.signal,
            pixelRatio: 1,
            viewport: {
              top: 0,
              left: 0,
              width: this.dstCanvas.width,
              height: this.dstCanvas.height,
            },
            phase: 'final',
            logger: RenderCycleLogger.current,
          },
        )

        this.emit('flushed')
      } finally {
        RenderCycleLogger.current.printLogs('onUIStrokeComplete')
      }
    } catch (e) {
      if (!(e instanceof PaplicoIgnoreableError)) throw e
    } finally {
      runtimeDoc.updaterLock.release(updateLock)
      this.tmpctxResource.release(tmpctx)
      this.strokingCtxResource.release(strkctx)

      this.setState((d) => (d.busy = false))
    }
  }

  protected createVectorObjectByCurrentSettings(
    path: VectorPath,
  ): VectorObject {
    const obj = createVectorObject({
      path: path,
      filters: [
        ...(this.state.currentFill
          ? ([
              { kind: 'fill', fill: deepClone(this.state.currentFill) },
            ] satisfies VectorAppearance[])
          : []),
        ...(this.state.currentStroke
          ? ([
              {
                kind: 'stroke',
                stroke: deepClone(this.state.currentStroke),
                ink: deepClone(this.state.currentInk),
              },
            ] satisfies VectorAppearance[])
          : []),
      ],
    })

    return obj
  }

  protected async rerenderForHistoryAffection() {
    this.rerenderQueue.push(
      'previewRender',
      async () => {
        this.rerender()
      },
      { maxQueue: 10 },
    )
  }

  // public onVectorObjectCreate() {}
}

function createStrokeEvent(stroke: UIStroke): Paplico.StrokeEvent {
  let prevented = false
  return {
    stroke,
    get defaultPrevented() {
      return prevented
    },
    preventDefault() {
      prevented = true
    },
  }
}

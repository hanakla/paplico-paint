import { RenderPipeline } from '@/Engine/RenderPipeline'
import { BrushRegistry } from '@/Engine/Registry/BrushRegistry'
import {
  createCanvas,
  createContext2D,
  getCanvasBytes,
} from '@/Infra/CanvasFactory'
import { VectorRenderer } from '@/Engine/VectorRenderer'
import { UICanvas } from '@/UI/UICanvas'
import { UIStroke } from '@/UI/UIStroke'
import { PaplicoDocument, VisuElement, VisuFilter } from '../Document'
import {
  clearCanvas,
  freeingCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { DocumentContext } from './DocumentContext/DocumentContext'
import { CircleBrush } from '../Brushes/CircleBrush'
import { Emitter, deepClone } from '@paplico/shared-lib'
import { RenderCycleLogger } from './RenderCycleLogger'
import { PlainInk } from '../Inks/PlainInk'
import { InkRegistry } from './Registry/InkRegistry'
import { RainbowInk } from '../Inks/RainbowInk'
import { TextureReadInk } from '../Inks/TextureReadInk'
import { AtomicResource } from '../utils/AtomicResource'
import {
  PPLCAbortError,
  PPLCIgnoreableError,
  PPLCInvariantViolationError,
  PPLCTargetEntityNotFoundError,
} from '../Errors'
import { ICommand } from '@/Engine/History/ICommand'
import * as Commands from '@/Commands'
import { AppearanceRegistry } from '@/Engine/Registry/AppearanceRegistry'
import { SVGExporter } from './Exporters/SVGExporter'
import { PNGExporter } from './Exporters/PNGExporter'
import { IExporter } from './Exporters/IExporter'
import { PSDExporter } from './Exporters/PSDExporter'
import { type History } from '@/Engine/History/History'
import { PreviewStore } from './DocumentContext/PreviewStore'
import { NoneImpls, type PaplicoComponents } from '@/UI/PaneUI/index'
import { type AbstractElementCreator } from '../UI/PaneUI/AbstractComponent'
import { BlurFilter, TestFilter } from '../Filters'
import { WebGLRenderer } from 'three'
import { PaneUIRenderings } from './PaneUIRenderings'
import { FontRegistry } from './Registry/FontRegistry'
import {
  aggregateRescueErrors,
  rescue,
  throwLaterIfFailure,
} from '@/utils/rescue'
import { LayerMetrics } from './DocumentContext/LayerMetrics'
import { PPLCOptionInvariantViolationError } from '@/Errors/PPLCOptionInvariantViolationError'
import { Canvas2DAllocator } from '@/Infra/Canvas2DAllocator'
import {
  DEFAULT_FILL_SETTING,
  DEFAULT_INK_SETTING,
  DEFAULT_BRUSH_SETTING,
} from './constants'
import { MicroCanvas } from './MicroCanvas'
import { TypenGlossary } from '@/TypesAndGlossary'
import { RenderQueuePriority, RenderReconciler } from './RenderReconciler'
import {
  createVectorObjectVisually,
  createVisuallyFilter,
} from '@/Document/Visually/factory'
import { LogChannel } from '@/Debugging/LogChannel'
import { chainSignalToAbortController } from '@/utils/abortcontroller'

export namespace Paplico {
  /** @deprecated */
  export type BrushSetting<
    T extends Record<string, any> = Record<string, any>,
  > = VisuFilter.Structs.BrushSetting<T>

  export type StrokingTarget = DocumentContext.StrokingTarget

  export type Preferences = {
    paneUILocale: SupportedLocales
    /** Simplify path tolerance, recommend to 0 to 6. 0 is no simplify */
    strokeTrelance: number
    /** Pixel ratio for rendering, default to 1 */
    pixelRatio: number

    colorSpace: PredefinedColorSpace
  }

  export type State = Readonly<{
    currentBrush: VisuFilter.Structs.BrushSetting | null
    currentFill: VisuFilter.Structs.FillSetting | null
    currentInk: VisuFilter.Structs.InkSetting
    strokeComposition: VisuElement.StrokeCompositeMode
    busy: boolean
  }>

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
    strokingTargetChanged: { current: DocumentContext.StrokingTarget | null }

    strokeStarted: StrokeEvent
    strokePreChange: StrokeEvent
    strokePreComplete: StrokeEvent
    strokeCancelled: StrokeEvent

    /** `finish` priority render completed event */
    finishRenderCompleted: void

    brushSettingChanged: { setting: Paplico.State['currentBrush'] }
    fillSettingChanged: { setting: Paplico.State['currentFill'] }
    inkSettingChanged: { setting: Paplico.State['currentInk'] }

    'preview:updated': PreviewStore.Events['updated']
    'history:affect': History.Events['affect']
    'document:layerUpdated': { layerEntityUid: string }
    'document:metrics:update': LayerMetrics.Events['update']
    'document:undo': History.Events['undo']
    'document:redo': History.Events['undo']
  }

  export type RenderOptions = {
    layerOverrides?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
    transformOverrides?: VectorRenderer.VisuTransformOverrides
    clearCache?: boolean
    destination?: CanvasRenderingContext2D
    pixelRatio?: number
    signal?: AbortSignal
  }

  export type RenderPathRenderOrder = 'stroke-first' | 'fill-first'

  export type RenderPathIntoOptions = {
    brushSetting: VisuFilter.Structs.BrushSetting | null
    inkSetting?: VisuFilter.Structs.InkSetting | null
    fillSetting: VisuFilter.Structs.FillSetting | null
    blendMode?: VisuElement.BlendMode
    strokeComposition?: TypenGlossary.StrokeCompositeMode
    order?: Paplico.RenderPathRenderOrder
    pixelRatio?: number
    clearDestination?: boolean
  }

  export type SupportedLocales = TypenGlossary.SupportedLocales

  export type _PaneImpl = {
    components: PaplicoComponents
    h: AbstractElementCreator
  }
}

/**
 * An frontend class of Paplico.
 */
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

  protected readonly tmpctxResource: AtomicResource<CanvasRenderingContext2D>
  protected readonly strokingCtxResource: AtomicResource<CanvasRenderingContext2D>

  // protected readonly rerenderQueue = new RenderQueue<'previewRender'>()
  protected readonly renderQueue = new RenderReconciler()
  protected activeStrokeChangeAborters: AbortController[] = []

  protected readonly _childMicroCanvases: WeakRef<MicroCanvas>[] = []

  protected idleRerenderTimerId: any

  protected readonly paneImpl: Paplico._PaneImpl

  protected readonly __dbg_Canvas2DAllocator: Canvas2DAllocator =
    Canvas2DAllocator

  #preferences: Paplico.Preferences = {
    paneUILocale: 'en',
    strokeTrelance: 5,
    pixelRatio: 1,
    colorSpace: 'srgb',
  }

  #state: Paplico.State = {
    currentBrush: null,
    currentFill: null,
    currentInk: DEFAULT_INK_SETTING(),
    strokeComposition: 'normal',
    busy: false,
  }

  // public static createWithDocument(
  //   canvas: HTMLCanvasElement,
  //   opt: { width: number; height: number },
  // ) {
  //   const pap = new Paplico(canvas)

  //   const doc = createDocument({ width: opt.width, height: opt.height })
  //   const layer = createRasterLayerEntity({
  //     width: opt.width,
  //     height: opt.height,
  //   })

  //   doc.visuallyElements.push(layer)
  //   doc.layerTree.children.push({
  //     vissualyUid: layer.uid,
  //     children: [],
  //   })

  //   pap.loadDocument(doc)
  //   pap.setStrokingTarget([layer.uid])

  //   return pap
  // }

  constructor(
    canvas: HTMLCanvasElement,
    opts: {
      paneUILocale?: string
      colorSpace?: PredefinedColorSpace
      paneComponentImpls?: PaplicoComponents
      paneCreateElement?: AbstractElementCreator
    } = {},
  ) {
    super()

    this.paneImpl = {
      components: opts.paneComponentImpls ?? NoneImpls,
      h: opts.paneCreateElement ?? (() => null),
    }

    this.#preferences.paneUILocale =
      typeof navigator !== 'undefined' && typeof navigator.language === 'string'
        ? (navigator.language.match(
            /^(en|ja)/,
          )?.[0] as Paplico.SupportedLocales) ?? 'en'
        : 'en'

    this.#preferences.colorSpace = opts.colorSpace ?? 'srgb'

    this.brushes = new BrushRegistry()
    this.brushes.register(CircleBrush)

    this.inks = new InkRegistry()
    this.inks.register(PlainInk)
    this.inks.register(RainbowInk)
    this.inks.register(TextureReadInk)

    this.filters = new AppearanceRegistry()
    this.filters.register(TestFilter)
    this.filters.register(BlurFilter)

    this.fonts = new FontRegistry()

    const renderer = new WebGLRenderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      canvas: createCanvas(),
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

  public exposeLogChannelToGlobalThis() {
    ;(globalThis as any).logc = LogChannel
    console.info('LogChannel exposed to globalThis.logc')
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

  protected setState(fn: (prev: Paplico.State) => Paplico.State) {
    this.#state = Object.freeze(deepClone(fn(this.#state)))

    this.emit('stateChanged', this.#state)
  }

  /** @deprecated Use `getStrokingTarget` instead */
  public get activeVisu(): DocumentContext.StrokingTarget | null {
    return this.runtimeDoc?.strokingTarget ?? null
  }

  protected initialize() {
    this.setState((d) => {
      return { ...d }
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
  }

  public dispose() {
    this.mitt.all.clear()

    this._childMicroCanvases.forEach((ref) => {
      ref.deref()?.dispose()
    })
    this._childMicroCanvases.splice(0)

    this.tmpctxResource.clearQueue()
    freeingCanvas(this.tmpctxResource.ensureForce().canvas)

    this.uiCanvas.dispose()
    this.runtimeDoc?.dispose()
    this.vectorRenderer.dispose()
    this.pipeline.dispose()

    this.glRendererResource.clearQueue()
    this.glRendererResource.ensureForce().dispose()
  }

  public createMicroCanvas(canvas: CanvasRenderingContext2D) {
    const mc = new MicroCanvas(canvas.canvas, this)
    this._childMicroCanvases
    return mc
  }

  public get visuMetrics() {
    return this.runtimeDoc?.layerMetrics
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
    this.runtimeDoc.on('preview:updated', (updateEntry) => {
      this.emit('preview:updated', updateEntry)
    })

    this.runtimeDoc.on('invalidateVectorPathCacheRequested', (e) => {
      this.vectorRenderer.invalidateStrokeMemo(e.object.path)
    })

    this.runtimeDoc.layerMetrics.on('update', (e) => {
      this.emit('document:metrics:update', e)
    })

    this.runtimeDoc.on('strokingTargetChanged', (e) => {
      this.emit('strokingTargetChanged', e)
    })

    this.runtimeDoc.history.on('undo', (e) => {
      this.emit('document:undo', e)
    })

    this.runtimeDoc.history.on('redo', (e) => {
      this.emit('document:redo', e)
    })

    this.runtimeDoc.history.on('affect', (e) => {
      if (e.layerIds.length === 0) return

      this.rerenderForHistoryAffection()

      aggregateRescueErrors([
        rescue(() => {
          e.layerIds.forEach((layerEntityUid) => {
            this.emit('document:layerUpdated', { layerEntityUid })
          })
        }),
        rescue(() => {
          this.emit('history:affect', e)
        }),
      ])
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

  public getStrokingTarget(): DocumentContext.StrokingTarget | null {
    return this.runtimeDoc?.strokingTarget ?? null
  }

  public setStrokingTarget(path: string[] | null) {
    if (!this.runtimeDoc) {
      console.warn('Paplico.enterLayer: No document loaded')
      return
    }

    this.runtimeDoc.setStrokingTarget(path)
  }

  public cloneInitialBrushSetting(): VisuFilter.Structs.BrushSetting {
    return DEFAULT_BRUSH_SETTING()
  }

  /** Get current stroke setting. returned objeccts is write safe (deep cloned) */
  public getBrushSetting(): VisuFilter.Structs.BrushSetting | null {
    return this.#state.currentBrush
  }

  public setBrushSetting(
    setting: Partial<VisuFilter.Structs.BrushSetting> | null,
  ) {
    this.setState((d) => {
      return {
        ...d,
        currentBrush: !setting
          ? null
          : {
              ...DEFAULT_BRUSH_SETTING(),
              ...d.currentBrush,
              ...setting,
            },
      }
    })

    this.emit('brushSettingChanged', { setting: this.#state.currentBrush })
  }

  /** Get current fill setting. returned objeccts is write safe (deep cloned) */
  public cloneInitialFillSetting(): VisuFilter.Structs.FillSetting {
    return DEFAULT_FILL_SETTING()
  }

  public getFillSetting(): VisuFilter.Structs.FillSetting | null {
    return this.#state.currentFill
  }

  public setFillSetting(
    setting: Partial<VisuFilter.Structs.FillSetting> | null,
  ) {
    this.setState((d) => {
      return {
        ...d,
        currentFill: !setting
          ? null
          : {
              ...DEFAULT_FILL_SETTING(),
              ...d.currentFill,
              ...setting,
            },
      }
    })

    this.emit('fillSettingChanged', { setting: this.#state.currentFill })
  }

  public cloneInitialInkSetting(): VisuFilter.Structs.InkSetting {
    return DEFAULT_INK_SETTING()
  }

  public getInkSetting(): VisuFilter.Structs.InkSetting {
    return this.#state.currentInk
  }

  public setInkSetting(setting: Partial<VisuFilter.Structs.InkSetting>) {
    this.setState((d) => {
      return { ...d, currentInk: { ...d.currentInk, ...setting } }
    })

    this.emit('inkSettingChanged', { setting: this.#state.currentInk })
  }

  public getPreferences(): Paplico.Preferences {
    return this.#preferences
  }

  public setPreferences(prefs: Partial<Paplico.Preferences>) {
    this.#preferences = Object.freeze({ ...this.#preferences, ...prefs })
  }

  public setStrokeCompositionMode(
    composition: Paplico.State['strokeComposition'],
  ) {
    this.setState((d) => {
      return { ...d, strokeComposition: composition }
    })
  }

  /** Queue canvas rerendering on idle time */
  public requestIdlePriolityRerender() {
    this.renderQueue.enqueue(async (signal) => {
      this.rerender({ signal })
    }, RenderQueuePriority.idleQue)
  }

  public requestPreviewPriolityRerender(options: Paplico.RenderOptions = {}) {
    const aborter = new AbortController()
    chainSignalToAbortController(options.signal, aborter)

    this.renderQueue.enqueue(async (signal) => {
      chainSignalToAbortController(signal, aborter)
      this.rerender({ ...options, signal: aborter.signal })
    }, RenderQueuePriority.preview)
  }

  public async rerender({
    layerOverrides,
    transformOverrides,
    destination,
    pixelRatio = this.#preferences.pixelRatio,
    clearCache,
    signal,
  }: Paplico.RenderOptions = {}) {
    if (!this.runtimeDoc) return

    const runtimeDoc = this.runtimeDoc
    const updateLock = await runtimeDoc.updaterLock.ensure()
    // -- ^ waiting for previous render commit

    try {
      RenderCycleLogger.current.log('Refresh all layers')

      const dstctx = destination ?? this.dstctx
      const dstCanvas = dstctx.canvas

      this.setState((d) => {
        return { ...d, busy: true }
      })

      if (clearCache) {
        this.runtimeDoc.invalidateAllLayerBitmapCache()
      }

      const metrices = await this.pipeline.fullyRenderWithScheduler(
        dstctx,
        runtimeDoc,
        this.vectorRenderer,
        {
          abort: signal,
          layerNodeOverrides: layerOverrides,
          transformOverrides,
          pixelRatio,
          viewport: {
            top: 0,
            left: 0,
            width: dstCanvas.width,
            height: dstCanvas.height,
          },
          phase: 'final',
          logger: RenderCycleLogger.current,
        },
      )

      if (metrices) {
        this.processMetrics(runtimeDoc, metrices.visuMetrics)
      }

      if (dstctx === this.dstctx) {
        throwLaterIfFailure([rescue(() => this.emit('finishRenderCompleted'))])
      }
    } catch (e) {
      if (e instanceof PPLCIgnoreableError) return
      throw e
    } finally {
      runtimeDoc.updaterLock.release(updateLock)
      this.setState((d) => {
        return { ...d, busy: false }
      })
      RenderCycleLogger.current.printLogs('rerender()')
    }
  }

  /**
   * Render path into specified destination
   *
   * This path is rendering with internal default brush settings.
   * (Not with current brush settings)
   */
  public async renderVectorVisuInto(
    visu: VisuElement.VectorObjectElement,
    destination: CanvasRenderingContext2D,
    {
      pixelRatio = this.#preferences.pixelRatio,
      strokeComposition = 'normal',
      clearDestination = false,
    }: Omit<
      Paplico.RenderPathIntoOptions,
      'brushSetting' | 'inkSetting' | 'fillSetting' | 'blendMode' | 'order'
    >,
  ) {
    if (strokeComposition === 'none') return

    const buf = Canvas2DAllocator.borrow({
      width: destination.canvas.width,
      height: destination.canvas.height,
    })

    try {
      await this.vectorRenderer.renderVectorVisu(visu, buf, {
        viewport: {
          left: 0,
          top: 0,
          width: destination.canvas.width,
          height: destination.canvas.height,
        },
        logger: RenderCycleLogger.createNext(),
        pixelRatio,
        phase: 'final',
      })

      saveAndRestoreCanvas(destination, () => {
        destination.globalCompositeOperation =
          strokeComposition === 'normal' ? 'source-over' : 'destination-out'

        if (clearDestination) clearCanvas(destination)
        destination.drawImage(buf.canvas, 0, 0)
      })
    } finally {
      Canvas2DAllocator.return(buf)
    }
  }

  public async putVisuPreview(
    newVisu: VisuElement.VectorObjectElement,
    options: {
      pathToTargetVisu?: string[]
      strokeComposition?: VisuElement.StrokeCompositeMode
      signal?: AbortSignal
    },
  ) {
    const aborter = new AbortController()
    this.activeStrokeChangeAborters.push(aborter)

    this.renderQueue.enqueue(async (signal) => {
      chainSignalToAbortController(signal, aborter)
      await this._internal_putVisuPreviewRender(newVisu, options)
    }, RenderQueuePriority.preview)
  }

  protected async _internal_putVisuPreviewRender(
    newVisu: VisuElement.VectorObjectElement,
    {
      pathToTargetVisu,
      strokeComposition = this.#state.strokeComposition,
      signal,
    }: {
      pathToTargetVisu?: string[]
      strokeComposition?: VisuElement.StrokeCompositeMode
      signal?: AbortSignal
    } = {},
  ) {
    if (signal?.aborted) return
    if (!this.runtimeDoc?.strokingTarget) return
    if (strokeComposition === 'none') return

    const renderLogger = RenderCycleLogger.createNext()

    const aborter = new AbortController()
    chainSignalToAbortController(signal, aborter)

    const docx = this.runtimeDoc // Lock reference
    const document = this.runtimeDoc.document // Lock reference
    const strokingTarget = pathToTargetVisu
      ? docx.document.layerNodes.getNodeDetailAtPath(pathToTargetVisu)
      : docx.strokingTarget! // Lock reference
    const targetVisu = docx.strokingTarget! // Lock reference
    const strokingTargetVisu = strokingTarget?.visu

    if (!strokingTarget || !strokingTargetVisu) {
      throw new PPLCTargetEntityNotFoundError(
        `Target node not found: /${pathToTargetVisu!.join('/')}`,
      )
    }

    if (!document.isDrawableVisu(strokingTarget.visu)) {
      if (pathToTargetVisu) {
        throw new PPLCOptionInvariantViolationError(
          `Target is not drawable and child-containable node: /${pathToTargetVisu.join(
            '/',
          )} `,
        )
      } else {
        throw new PPLCInvariantViolationError(
          `Target is not drawable and child-containable(type: ${strokingTarget.visuType}, path: ${strokingTarget.nodePath}`,
        )
      }
    }

    const [tmpctx, strkctx] = await Promise.all([
      this.tmpctxResource.ensure(),
      this.strokingCtxResource.ensure(),
    ])

    const dstctx = this.dstctx

    LogChannel.l.pplcStroking('UIStrokeChange: Start onUIStrokeChange')

    try {
      if (aborter.signal.aborted) {
        throw new PPLCAbortError()
      }

      // clear first, if clear after render, it will cause visually freeze
      setCanvasSize(
        tmpctx.canvas,
        {
          width: dstctx.canvas.width,
          height: dstctx.canvas.height,
        },
        { clear: true },
      )

      if (strokingTargetVisu.type === 'group') {
        LogChannel.l.pplcStroking('UIStrokeChange: Start group rendering')

        const node = docx.document.layerNodes.getResolvedLayerNodes(
          targetVisu.nodePath,
        )
        if (node.visu.type)
          node.children.push({
            uid: newVisu.uid,
            children: [],
            visu: newVisu,
            path: [...targetVisu.nodePath, newVisu.uid],
          })

        await this.pipeline.renderNode(
          tmpctx,
          docx,
          node,
          this.vectorRenderer,
          {
            abort: aborter.signal,
            pixelRatio: this.#preferences.pixelRatio,
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

        LogChannel.l.pplcStroking('UIStrokeChange: Complete render group')
      } else if (strokingTargetVisu.type === 'canvas') {
        LogChannel.l.pplcStroking('UIStrokeChange: Start canvas rendering')

        const currentBitmap = (await docx.getOrCreateLayerNodeBitmapCache(
          targetVisu.visuUid,
        ))!

        setCanvasSize(
          strkctx.canvas,
          { width: currentBitmap.width, height: currentBitmap.height },
          { clear: true },
        )

        // Copy current layer image to tmpctx
        tmpctx.drawImage(currentBitmap, 0, 0)

        renderLogger.log('render stroke')

        // Write stroke to current layer
        await this.vectorRenderer.renderVectorVisu(newVisu, strkctx, {
          abort: aborter.signal,
          pixelRatio: this.#preferences.pixelRatio,
          viewport: {
            left: 0,
            top: 0,
            width: currentBitmap.width,
            height: currentBitmap.height,
          },
          phase: 'stroking',
          logger: renderLogger,
        })

        saveAndRestoreCanvas(tmpctx, () => {
          tmpctx.globalCompositeOperation =
            strokeComposition === 'normal' ? 'source-over' : 'destination-out'

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
          throw new PPLCAbortError()
        }

        LogChannel.l.pplcStroking(
          'UIStrokeChange: Finishing preview... (fullyRender)',
        )

        // Ignore metrices for preview
        await this.pipeline.fullyRenderWithScheduler(
          dstctx,
          this.runtimeDoc,
          this.vectorRenderer,
          {
            layerNodeOverrides: { [targetVisu.visuUid]: tmpctx.canvas },
            abort: aborter.signal,
            pixelRatio: this.#preferences.pixelRatio,
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
      } finally {
        clearCanvas(tmpctx)
        renderLogger.printLogs('onUIStrokeChange')
        LogChannel.l.pplcStroking('UIStrokeChange: Finished ')
      }
    } catch (e) {
      if (!(e instanceof PPLCIgnoreableError)) {
        throw e
      } else {
        // console.info('ignoreable error', e)
      }
    } finally {
      this.tmpctxResource.release(tmpctx)
      this.strokingCtxResource.release(strkctx)
    }
  }

  public async putVisuComplete(
    newVisu: VisuElement.VectorObjectElement,
    {
      pathToTargetVisu,
      strokeComposition = this.#state.strokeComposition,
    }: {
      pathToTargetVisu?: string[]
      strokeComposition?: VisuElement.StrokeCompositeMode
    },
  ) {
    if (!this.runtimeDoc) return
    if (!pathToTargetVisu && !this.runtimeDoc.strokingTarget) return
    if (this.state.strokeComposition === 'none') return

    RenderCycleLogger.createNext()
    RenderCycleLogger.current.log('start: stroke complete')

    // Cancel all waiting stroke change render queue
    this.activeStrokeChangeAborters.forEach((aborter) => aborter.abort())
    this.activeStrokeChangeAborters = []

    const docx = this.runtimeDoc // Lock reference
    const document = this.runtimeDoc.document // Lock reference
    const strokingTarget = pathToTargetVisu
      ? docx.document.layerNodes.getNodeDetailAtPath(pathToTargetVisu)
      : docx.strokingTarget! // Lock reference
    const strokingTargetVisu = strokingTarget?.visu

    if (!strokingTarget || !strokingTargetVisu) {
      throw new PPLCTargetEntityNotFoundError(
        `Target node not found: /${pathToTargetVisu!.join('/')}`,
      )
    }

    if (!document.isDrawableVisu(strokingTarget.visu)) {
      if (pathToTargetVisu) {
        throw new PPLCOptionInvariantViolationError(
          `Target is not drawable and child-containable node: /${pathToTargetVisu.join(
            '/',
          )} `,
        )
      } else {
        throw new PPLCInvariantViolationError(
          `Target is not drawable and child-containable(type: ${strokingTarget.visuType}, path: ${strokingTarget.nodePath}`,
        )
      }
    }

    const updateLock = await docx.updaterLock.ensure()
    // -- ^ waiting for previous render commit

    // Not do this, commit is must be completion or failed
    // This aborter is not used
    const aborter = new AbortController()

    const tmpctx = Canvas2DAllocator.borrow({
      width: this.dstCanvas.width,
      height: this.dstCanvas.height,
    })

    const strkctx = await this.strokingCtxResource.ensure()
    const dstctx = this.dstctx

    this.setState((d) => {
      return { ...d, busy: true }
    })

    try {
      // clear first, if clear after render, it will cause visually freeze

      RenderCycleLogger.current.time('toSimplefiedPath')

      RenderCycleLogger.current.timeEnd('toSimplefiedPath')

      if (strokingTarget.visuType === 'group') {
        await this.command.do(
          new Commands.DocumentManipulateLayerNodes({
            add: [
              {
                visu: newVisu,
                parentNodePath: strokingTarget.nodePath,
                indexInNode: -1,
              },
            ],
          }),
        )
      } else if (strokingTargetVisu.type === 'canvas') {
        const currentBitmap = (await docx.getOrCreateLayerNodeBitmapCache(
          strokingTargetVisu.uid,
        ))!

        setCanvasSize(tmpctx.canvas, currentBitmap, { clear: true })
        setCanvasSize(strkctx.canvas, currentBitmap, { clear: true })

        // Copy current layer image to tmpctx
        tmpctx.drawImage(currentBitmap, 0, 0)

        // Write stroke to current layer
        await this.vectorRenderer.renderVectorVisu(newVisu, strkctx, {
          abort: aborter.signal,
          viewport: {
            top: 0,
            left: 0,
            width: currentBitmap.width,
            height: currentBitmap.height,
          },
          pixelRatio: this.#preferences.pixelRatio,
          phase: 'final',
          logger: RenderCycleLogger.current,
        })

        saveAndRestoreCanvas(tmpctx, () => {
          tmpctx.globalCompositeOperation =
            strokeComposition === 'normal' ? 'source-over' : 'destination-out'

          tmpctx.drawImage(strkctx.canvas, 0, 0)
        })

        // Update layer image data
        LogChannel.l.pplcStroking(
          `UIStrokeComplete: Committing new bitmap (with ${strokeComposition})`,
        )

        const imageData = tmpctx.getImageData(
          0,
          0,
          currentBitmap.width,
          currentBitmap.height,
        ).data

        await this.command.do(
          new Commands.CanvasVisuUpdateBitmap(strokingTargetVisu.uid, {
            updater: (bitmap) => {
              bitmap.set(imageData)
            },
          }),
        )
      } else {
        return
      }

      try {
        RenderCycleLogger.current.log('Refresh all layers')

        LogChannel.l.pplcStroking(
          `UIStrokeComplete: Finishing update... (fullyRender)`,
        )

        const result = await this.pipeline.fullyRenderWithScheduler(
          dstctx,
          docx,
          this.vectorRenderer,
          {
            // abort: aborter.signal,
            pixelRatio: this.#preferences.pixelRatio,
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

        if (result) {
          this.processMetrics(docx, result.visuMetrics)
        }

        throwLaterIfFailure([rescue(() => this.emit('finishRenderCompleted'))])
      } finally {
        RenderCycleLogger.current.printLogs('onUIStrokeComplete')
      }
    } catch (e) {
      if (!(e instanceof PPLCIgnoreableError)) throw e
    } finally {
      Canvas2DAllocator.return(tmpctx)
      docx.updaterLock.release(updateLock)
      this.strokingCtxResource.release(strkctx)

      LogChannel.l.pplcStroking('UIStrokeChange: Finished ')

      this.setState((d) => {
        return { ...d, busy: false }
      })
    }
  }

  /**
   * Execute stroke preview process with specified stroke.
   * Painting content will be clearing after next stroke change.
   */
  public async putStrokePreview(
    stroke: UIStroke,
    {
      pathToTargetVisu,
      brushSetting = deepClone(this.#state.currentBrush),
      inkSetting,
      fillSetting = deepClone(this.#state.currentFill),
      strokeComposition = deepClone(this.#state.strokeComposition),
    }: {
      pathToTargetVisu?: string[]
      brushSetting?: VisuFilter.Structs.BrushSetting<any> | null
      inkSetting?: VisuFilter.Structs.InkSetting<any> | null
      fillSetting?: VisuFilter.Structs.FillSetting | null
      strokeComposition?: VisuElement.StrokeCompositeMode
    } = {},
  ) {
    if (!this.runtimeDoc) {
      throw new PPLCOptionInvariantViolationError(
        'putStrokePreview: Document not loaded',
      )
    }

    inkSetting ??= this.#state.currentInk // Disallow null

    const newVisu = createVectrObjectVisuWithSettings(
      stroke.toPath(),
      fillSetting,
      brushSetting,
      inkSetting,
    )

    await this.putVisuPreview(newVisu, {
      pathToTargetVisu,
      strokeComposition,
    })
  }

  /**
   * Execute stroke completion process with specified stroke.
   *
   * Painting content commited document and history.
   */
  public async putStrokeComplete(
    stroke: UIStroke,
    {
      pathToTargetVisu,
      brushSetting = deepClone(this.#state.currentBrush),
      inkSetting,
      fillSetting = deepClone(this.#state.currentFill),
      strokeComposition = deepClone(this.#state.strokeComposition),
    }: {
      pathToTargetVisu?: string[]
      brushSetting?: VisuFilter.Structs.BrushSetting<any> | null
      inkSetting?: VisuFilter.Structs.InkSetting<any> | null
      fillSetting?: VisuFilter.Structs.FillSetting | null
      strokeComposition?: VisuElement.StrokeCompositeMode
    } = {},
  ) {
    inkSetting ??= this.#state.currentInk // Disallow null

    const newVisu = createVectrObjectVisuWithSettings(
      stroke.toSimplifiedPath({
        tolerance: this.#preferences.strokeTrelance,
      }),
      fillSetting,
      brushSetting,
      inkSetting,
    )

    await this.putVisuComplete(newVisu, {
      pathToTargetVisu,
      strokeComposition: strokeComposition,
    })
  }

  protected async onUIStrokeChange(stroke: UIStroke): Promise<void> {
    const aborter = new AbortController()
    this.activeStrokeChangeAborters.push(aborter)
    await this.putStrokePreview(stroke)
  }

  protected async onUIStrokeComplete(stroke: UIStroke) {
    await this.putStrokeComplete(stroke)
  }

  protected createVectorObjectByCurrentSettings(
    path: VisuElement.VectorPath,
  ): VisuElement.VectorObjectElement {
    const obj = createVectorObjectVisually({
      path: path,
      filters: [
        ...(this.state.currentFill
          ? [
              createVisuallyFilter('fill', {
                fill: deepClone(this.state.currentFill),
              }),
            ]
          : []),
        ...(this.state.currentBrush
          ? [
              createVisuallyFilter('stroke', {
                stroke: deepClone(this.state.currentBrush),
                ink: deepClone(this.state.currentInk),
              }),
            ]
          : []),
      ],
    })

    return obj
  }

  protected processMetrics(
    runtimeDoc: DocumentContext,
    metrices: Record<string, LayerMetrics.BBoxSet>,
  ) {
    runtimeDoc.updateVisuMetrices(metrices)
  }

  protected async rerenderForHistoryAffection() {
    this.renderQueue.enqueue(async (signal) => {
      this.rerender({ signal })
    }, RenderQueuePriority.finish)
  }
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

function createVectrObjectVisuWithSettings(
  path: VisuElement.VectorPath,
  fill: VisuFilter.Structs.FillSetting | null,
  brush: VisuFilter.Structs.BrushSetting | null,
  ink: VisuFilter.Structs.InkSetting,
) {
  return createVectorObjectVisually({
    path: path,
    filters: [
      ...(fill
        ? [
            createVisuallyFilter('fill', {
              fill: deepClone(fill),
            }),
          ]
        : []),
      ...(brush
        ? [
            createVisuallyFilter('stroke', {
              stroke: deepClone(brush),
              ink: deepClone(ink),
            }),
          ]
        : []),
    ],
  })
}

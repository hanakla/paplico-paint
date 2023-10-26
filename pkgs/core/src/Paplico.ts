import immer, { Draft } from 'immer'

import { RenderPipeline } from '@/Engine/RenderPipeline'
import { BrushRegistry } from '@/Engine/Registry/BrushRegistry'
import {
  createCanvas,
  createContext2D,
  getCanvasBytes,
} from '@/Engine/CanvasFactory'
import { VectorRenderer } from '@/Engine/VectorRenderer'
import { UICanvas } from '@/UI/UICanvas'
import { UIStroke } from '@/UI/UIStroke'
import {
  createDocument,
  createRasterLayerEntity,
  createVectorObject,
  LayerEntity,
  LayerFilter,
  LayerNode,
  PaplicoDocument,
  VectorObject,
  VectorPath,
} from './Document'
import {
  clearCanvas,
  freeingCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { RuntimeDocument } from './Engine/RuntimeDocument'
import { VectorStrokeSetting } from './Document/LayerEntity/VectorStrokeSetting'
import { VectorFillSetting } from './Document/LayerEntity/VectorFillSetting'
import { InkSetting as _InkSetting } from './Document/LayerEntity/InkSetting'
import { deepClone } from './utils/object'
import { VectorAppearance } from './Document/LayerEntity/VectorAppearance'
import { CircleBrush } from './Brushes/CircleBrush'
import { Emitter } from './utils/Emitter'
import { BrushClass } from './Engine/Brush'
import { RenderCycleLogger } from './Engine/RenderCycleLogger'
import { PlainInk } from './Inks/PlainInk'
import { InkRegistry } from './Engine/Registry/InkRegistry'
import { RainbowInk } from './Inks/RainbowInk'
import { TextureReadInk } from './Inks/TextureReadInk'
import { AtomicResource } from './utils/AtomicResource'
import { PaplicoAbortError, PaplicoIgnoreableError } from './Errors'
import { ICommand } from '@/History/ICommand'
import * as Commands from '@/History/Commands'
import { AsyncQueue } from './utils/AsyncQueue'
import { AppearanceRegistry } from '@/Engine/Registry/AppearanceRegistry'
import { SVGExporter } from './Engine/Exporters/SVGExporter'
import { PNGExporter } from './Engine/Exporters/PNGExporter'
import { IExporter } from './Engine/Exporters/IExporter'
import { PSDExporter } from './Engine/Exporters/PSDExporter'
import { type History } from '@/History/History'
import { PreviewStore } from './Engine/PreviewStore'
import { logImage } from './utils/DebugHelper'
import { NoneImpls, PaneSetState, PaplicoComponents } from '@/UI/PaneUI/index'
import { AbstractComponentRenderer } from './UI/PaneUI/AbstractComponent'
import { TestFilter } from './Filters'
import { WebGLRenderer } from 'three'

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

  export type Events = {
    stateChanged: Paplico.State
    documentChanged: {
      previous: PaplicoDocument | null
      current: PaplicoDocument | null
    }
    activeLayerChanged: { current: Paplico.ActiveLayer | null }
    flushed: void
    'preview:updated': PreviewStore.Events['updated']
    'history:affect': History.Events['affect']
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
  brushId: CircleBrush.id,
  brushVersion: CircleBrush.version,
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

  public readonly pipeline: RenderPipeline
  public readonly renderer: VectorRenderer
  public readonly uiCanvas: UICanvas

  protected readonly dstCanvas: HTMLCanvasElement
  protected readonly dstctx: CanvasRenderingContext2D
  protected readonly glRendererResource: AtomicResource<WebGLRenderer>

  protected document: PaplicoDocument | null = null
  protected runtimeDoc: RuntimeDocument | null = null

  protected beforeCommitAborter: AbortController = new AbortController()
  protected readonly tmpctxResource: AtomicResource<CanvasRenderingContext2D>
  protected readonly strokingCtxResource: AtomicResource<CanvasRenderingContext2D>

  protected readonly rerenderQueue = new AsyncQueue()
  protected activeStrokeChangeAborters: AbortController[] = []

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
    pap.enterLayer([layer.uid])

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
    this.renderer = new VectorRenderer({
      brushRegistry: this.brushes,
      inkRegistry: this.inks,
      appearanceRegistry: this.filters,
      glRenderer: this.glRendererResource,
    })
    this.uiCanvas = new UICanvas(canvas).activate()

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

  protected setState(fn: (draft: Draft<Paplico.State>) => void) {
    this.#state = immer(this.#state, (d) => {
      fn(d)
    })
    this.emit('stateChanged', this.#state)
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
    this.uiCanvas.on('strokeStart', (stroke) => {})
    this.uiCanvas.on('strokeChange', this.onUIStrokeChange)
    this.uiCanvas.on('strokeComplete', this.onUIStrokeComplete)
    this.uiCanvas.on('strokeCancel', () => {})

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
    this.renderer.dispose()
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

  public readonly paneUI = {
    renderFilterPane: (layerUid: string, entry: LayerFilter<any>) => {
      const Class = this.filters.getClass(entry.filterId)
      if (!Class) return null

      const setState: PaneSetState<any> = <T extends Record<string, any>>(
        patchOrFn: Partial<T> | ((prev: T) => T),
      ) => {
        let cmd: ICommand

        if (typeof patchOrFn === 'function') {
          const next = patchOrFn({ ...entry.settings })
          cmd = new Commands.FilterUpdateParameter(layerUid, entry.uid, next)
        } else {
          const next = { ...entry.settings, ...patchOrFn }
          cmd = new Commands.FilterUpdateParameter(layerUid, entry.uid, next)
        }

        this.command.do(cmd)
      }

      return Class.renderPane({
        c: this.paneImpl.components,
        components: this.paneImpl.components,
        h: this.paneImpl.h,
        state: { ...entry.settings },
        setState,
      })
    },
  }

  public loadDocument(doc: PaplicoDocument) {
    const prevDocument = this.document
    this.runtimeDoc?.dispose()

    this.document = doc
    this.runtimeDoc = new RuntimeDocument(doc)
    this.runtimeDoc.previews.on('updated', (updateEntry) => {
      this.emit('preview:updated', updateEntry)
    })

    this.runtimeDoc.history.on('affect', (e) => {
      this.rerenderForHistoryAffection()
      this.emit('history:affect', e)
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

  public enterLayer(path: string[]) {
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

  public async rerender({
    layerOverrides,
    destination,
    pixelRatio = 1,
    signal,
  }: {
    layerOverrides?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
    destination?: CanvasRenderingContext2D
    pixelRatio?: number
    signal?: AbortSignal
  } = {}) {
    if (!this.runtimeDoc) return

    try {
      RenderCycleLogger.current.log('Refresh all layers')

      const dstctx = destination ?? this.dstctx
      const dstCanvas = dstctx.canvas

      await this.pipeline.fullyRender(dstctx, this.runtimeDoc, this.renderer, {
        abort: signal,
        override: layerOverrides,
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
    } finally {
      RenderCycleLogger.current.printLogs('rerender()')
    }
  }

  protected async onUIStrokeChange(stroke: UIStroke): Promise<void> {
    const aborter = new AbortController()
    this.activeStrokeChangeAborters.push(aborter)

    this.rerenderQueue.push('previewRender', async () => {
      this.onUIStrokeChangeProcess.call(this, stroke, aborter)
    })
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

      if (this.activeLayerEntity.layerType === 'vector') {
        const obj = this.createVectorObjectByCurrentSettings(stroke)

        await this.renderer.renderVectorLayer(
          tmpctx.canvas,
          {
            ...this.activeLayerEntity,
            objects: [...this.activeLayerEntity.objects, obj],
          },
          {
            abort: aborter.signal,
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
      } else if (this.activeLayerEntity.layerType === 'raster') {
        if (!this.#state.currentStroke) return

        const currentBitmap =
          (await this.runtimeDoc.getOrCreateLayerBitmapCache(
            this.activeLayerEntity.uid,
          ))!

        setCanvasSize(tmpctx.canvas, currentBitmap.width, currentBitmap.height)
        clearCanvas(tmpctx)

        setCanvasSize(strkctx.canvas, currentBitmap.width, currentBitmap.height)
        clearCanvas(strkctx)

        // Copy current layer image to tmpctx
        tmpctx.drawImage(currentBitmap, 0, 0)

        renderLogger.log('render stroke')

        // Write stroke to current layer
        await this.renderer.renderStroke(
          strkctx.canvas,
          path,
          this.#state.currentStroke!,
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
          this.renderer,
          {
            override: { [this.activeLayerEntity.uid]: tmpctx.canvas },
            abort: aborter.signal,
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
    RenderCycleLogger.createNext()
    RenderCycleLogger.current.log('start: stroke complete')

    // Cancel all waiting stroke change render queue
    this.activeStrokeChangeAborters.forEach((aborter) => aborter.abort())
    this.activeStrokeChangeAborters = []

    if (!this.runtimeDoc) return
    if (!this.activeLayerEntity) return
    if (this.#state.busy) return

    const updateLock = await this.runtimeDoc.updaterLock.ensure()
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

      if (this.activeLayerEntity.layerType === 'vector') {
        const obj = this.createVectorObjectByCurrentSettings(path)

        await this.command.do(
          new Commands.VectorUpdateLayer(this.activeLayerEntity.uid, {
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

        // console.log('draw', this.activeLayerEntity)

        await this.renderer.renderVectorLayer(
          tmpctx.canvas,
          this.activeLayerEntity,
          {
            abort: aborter.signal,
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

        await this.runtimeDoc.updateOrCreateLayerBitmapCache(
          this.activeLayerEntity.uid,
          tmpctx.getImageData(0, 0, tmpctx.canvas.width, tmpctx.canvas.height),
        )
      } else if (this.activeLayerEntity.layerType === 'raster') {
        if (!this.#state.currentStroke) return

        const currentBitmap =
          (await this.runtimeDoc.getOrCreateLayerBitmapCache(
            this.activeLayerEntity.uid,
          ))!

        setCanvasSize(tmpctx.canvas, currentBitmap.width, currentBitmap.height)
        clearCanvas(tmpctx)

        setCanvasSize(strkctx.canvas, currentBitmap.width, currentBitmap.height)
        clearCanvas(strkctx)

        // Copy current layer image to tmpctx
        tmpctx.drawImage(currentBitmap, 0, 0)

        // Write stroke to current layer
        await this.renderer.renderStroke(
          strkctx.canvas,
          path,
          this.#state.currentStroke!,
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
          new Commands.RasterUpdateBitmap(this.activeLayerEntity.uid, {
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
          this.runtimeDoc,
          this.renderer,
          {
            // abort: aborter.signal,
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
      this.runtimeDoc.updaterLock.release(updateLock)
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
    RenderCycleLogger.createNext()

    RenderCycleLogger.current.log('start: rerender by history affection')

    if (!this.runtimeDoc) return
    if (!this.activeLayerEntity) return
    if (this.#state.busy) return

    const updateLock = await this.runtimeDoc.updaterLock.ensure()
    // -- ^ waiting for previous render commit

    this.beforeCommitAborter?.abort()
    this.beforeCommitAborter = new AbortController()

    // this.lastRenderAborter?.abort()

    // Not do this, commit is must be completion or failed
    // const aborter = (this.lastRenderAborter = new AbortController())
    // This aborter is not used
    const aborter = new AbortController()

    const tmpctx = await this.tmpctxResource.ensure()
    const dstctx = this.dstctx

    this.setState((d) => (d.busy = true))

    try {
      await this.pipeline.fullyRender(dstctx, this.runtimeDoc, this.renderer, {
        abort: aborter.signal,
        viewport: {
          top: 0,
          left: 0,
          width: this.dstCanvas.width,
          height: this.dstCanvas.height,
        },
        phase: 'final',
        logger: RenderCycleLogger.current,
      })
    } catch (e) {
      if (!(e instanceof PaplicoIgnoreableError)) throw e
    } finally {
      this.runtimeDoc.updaterLock.release(updateLock)
      this.tmpctxResource.release(tmpctx)
      this.setState((d) => (d.busy = false))
    }
  }

  // public onVectorObjectCreate() {}
}

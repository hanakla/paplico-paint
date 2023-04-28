import immer, { Draft } from 'immer'

import { MixerPipeline } from '@/Engine/MixerPipeline'
import { BrushRegistry } from '@/Engine/BrushRegistry'
import { createCanvas } from '@/Engine/CanvasFactory'
import { Renderer } from '@/Engine/Renderer'
import { UICanvas } from '@/UI/UICanvas'
import { UIStroke } from '@/UI/UIStroke'
import {
  createVectorObject,
  LayerEntity,
  LayerNode,
  PaplicoDocument,
  VectorObject,
} from './Document'
import { setCanvasSize } from '@/utils/canvas'
import { RuntimeDocument } from './Engine/RuntimeDocument'
import { VectorStrokeSetting } from './Document/LayerEntity/VectorStrokeSetting'
import { VectorFillSetting } from './Document/LayerEntity/VectorFillSetting'
import { InkSetting as _InkSetting } from './Document/LayerEntity/InkSetting'
import { deepClone } from './utils/object'
import { VectorAppearance } from './Document/LayerEntity/VectorAppearance'
import { CircleBrush } from './Engine/Brushes/CircleBrush'
import { Emitter } from './utils/Emitter'
import { BrushClass } from './Engine/Brush'
import { RenderCycleLogger } from './Engine/RenderCycleLogger'
import { PlainInk } from './Engine/Inks/PlainInk'
import { InkRegistry } from './Engine/InkRegistry'
import { RainbowInk } from './Engine/Inks/RainbowInk'
import { TextureReadInk } from './Engine/Inks/TextureReadInk'
import { AtomicResource } from './utils/AtomicResource'
import { PaplicoAbortError, PaplicoIgnoreableError } from './Errors'

export namespace Paplico {
  export type StrokeSetting<T extends Record<string, any> = any> =
    VectorStrokeSetting<T>

  export type FillSetting = VectorFillSetting

  export type InkSetting = _InkSetting

  export type State = {
    activeLayer: {
      layerType: LayerEntity['layerType']
      layerUid: string
      pathToLayer: string[]
    } | null
    currentStroke: StrokeSetting | null
    currentFill: FillSetting | null
    currentInk: InkSetting
    strokeComposition: 'normal' | 'erase'
    brushEntries: BrushClass[]
    busy: boolean
  }
}

type Events = {
  stateChanged: Paplico.State
}

const singletonCall = <T extends (...args: any[]) => Promise<void>>(fn: T) => {
  let last: Promise<void> | null = null
  let tailingArgs: Parameters<T> | null = null

  const execute = (...args: Parameters<T>) => {
    if (last) {
      tailingArgs = args
      return last
    }

    try {
      last = fn(...args)
      return last
    } finally {
      if (tailingArgs) {
        let args = tailingArgs
        last = null
        tailingArgs = null
        execute(...args)
      }

      tailingArgs = null
      last = null
    }
  }

  return execute
}

export class Paplico extends Emitter<Events> {
  public brushes: BrushRegistry
  public inks: InkRegistry

  public pipeline: MixerPipeline
  public renderer: Renderer
  public uiCanvas: UICanvas

  protected dstCanvas: HTMLCanvasElement
  protected dstctx: CanvasRenderingContext2D
  // protected tmp: HTMLCanvasElement
  // protected tmpctx: CanvasRenderingContext2D

  protected document: PaplicoDocument | null = null
  protected runtimeDoc: RuntimeDocument | null = null

  // protected activeLayerStatus: | null = null
  protected lastRenderAborter: AbortController | null = null
  protected beforeCommitAborter: AbortController = new AbortController()
  protected tmpctxResource: AtomicResource<CanvasRenderingContext2D>

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

  constructor(canvas: HTMLCanvasElement) {
    super()

    this.brushes = new BrushRegistry()
    this.brushes.register(CircleBrush)

    this.inks = new InkRegistry()
    this.inks.register(PlainInk)
    this.inks.register(RainbowInk)
    this.inks.register(TextureReadInk)

    this.pipeline = new MixerPipeline({ brushRegistry: this.brushes, canvas })
    this.renderer = new Renderer({
      brushRegistry: this.brushes,
      inkRegistry: this.inks,
    })
    this.uiCanvas = new UICanvas(canvas).activate()

    this.dstCanvas = canvas
    this.dstctx = canvas.getContext('2d')!

    const tmpCanvas = createCanvas()
    const tmpctx = tmpCanvas.getContext('2d', { willReadFrequently: true })!
    this.tmpctxResource = new AtomicResource(tmpctx, 'Paplico#tmpctx')

    this.onUIStrokeChange = this.onUIStrokeChange.bind(this)
    this.onUIStrokeComplete = this.onUIStrokeComplete.bind(this)
    this.initilize()
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
    // if (!this.#state.activeLayer) return null
    // return this.document!.resolveLayerEntity(this.#state.activeLayer.layerUid)!
  }

  protected initilize() {
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
    this.uiCanvas.dispose()
  }

  public loadDocument(doc: PaplicoDocument) {
    this.document = doc
    this.runtimeDoc = new RuntimeDocument(doc)

    doc.blobs.forEach((blob) => {
      this.runtimeDoc?.setBlobCache(
        blob.uid,
        new Blob([blob.data], { type: blob.mimeType })
      )
    })
  }

  public enterLayer(path: string[]) {
    if (!this.document) return

    // Dig layer
    let cursor = this.document.layerTree
    let target: LayerNode | null = null

    for (const uid of path) {
      let result = cursor.find((layer) => layer.layerUid === uid)
      if (!result) break
      if (result.layerUid === uid) {
        target = result
        break
      }
      cursor = result.children
    }

    if (!target) {
      console.warn(`Paplico.enterLayer: Layer not found: ${path.join('/')}`)
      return
    }

    const layer = this.document.resolveLayerEntity(target.layerUid)!

    this.#state = immer(this.#state, (d) => {
      d.activeLayer = {
        layerType: layer.layerType,
        layerUid: target!.layerUid,
        pathToLayer: path,
      }
    })
    this.#activeLayerEntity = layer

    console.info(`Enter layer: ${path.join('/')}`)
  }

  public set strokeSetting(setting: Paplico.StrokeSetting | null) {
    this.setState((d) => {
      d.currentStroke = setting
    })
  }

  public get strokeSetting(): Paplico.StrokeSetting | null {
    return this.#state.currentStroke
  }

  public set fillSetting(setting: Paplico.FillSetting | null) {
    this.setState((d) => {
      d.currentFill = setting
    })
  }

  public get fillSetting(): Paplico.FillSetting | null {
    return this.#state.currentFill
  }

  public set strokeComposition(
    composition: Paplico.State['strokeComposition']
  ) {
    this.setState((d) => {
      d.strokeComposition = composition
    })
  }

  protected async onUIStrokeChange(stroke: UIStroke) {
    if (!this.runtimeDoc) return
    if (!this.activeLayerEntity) return
    if (this.#state.busy) return

    const renderLogger = RenderCycleLogger.createNext()

    this.lastRenderAborter?.abort()
    const aborter =
      Math.random() > 0.5
        ? (this.lastRenderAborter = new AbortController())
        : this.beforeCommitAborter

    const tmpctx = await this.tmpctxResource.ensure()
    const dstctx = this.dstctx

    try {
      if (aborter.signal.aborted) {
        throw new PaplicoAbortError()
      }

      // clear first, if clear after render, it will cause visually freeze
      tmpctx.clearRect(0, 0, tmpctx.canvas.width, tmpctx.canvas.height)

      const path = stroke.toPath()

      if (this.activeLayerEntity.layerType === 'vector') {
        const obj = this.createVectorObjectByStrokeAndCurrentSettings(stroke)

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
            logger: renderLogger,
          }
        )
      } else if (this.activeLayerEntity.layerType === 'raster') {
        if (!this.strokeSetting) return

        const currentBitmap =
          (await this.runtimeDoc.getOrCreateLayerBitmapCache(
            this.activeLayerEntity.uid
          ))!

        setCanvasSize(tmpctx.canvas, currentBitmap.width, currentBitmap.height)

        // Copy current layer image to tmpctx
        tmpctx.clearRect(0, 0, tmpctx.canvas.width, tmpctx.canvas.height)
        tmpctx.drawImage(currentBitmap, 0, 0)

        renderLogger.log('render stroke')
        // Write stroke to current layer
        await this.renderer.renderStroke(
          tmpctx.canvas,
          path,
          this.strokeSetting,
          {
            inkSetting: this.#state.currentInk,
            abort: aborter.signal,
            transform: {
              position: { x: 0, y: 0 },
              scale: { x: 1, y: 1 },
              rotation: 0,
            },
            logger: renderLogger,
          }
        )
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
            logger: renderLogger,
          }
        )
      } finally {
        tmpctx.clearRect(0, 0, tmpctx.canvas.width, tmpctx.canvas.height)
        renderLogger.printLogs('onUIStrokeChange')
      }
    } catch (e) {
      if (!(e instanceof PaplicoIgnoreableError)) {
        throw e
      } else {
        console.info('ignoreable error', e)
      }
    } finally {
      this.tmpctxResource.release(tmpctx)
    }
  }

  protected async onUIStrokeComplete(stroke: UIStroke) {
    RenderCycleLogger.createNext()

    RenderCycleLogger.current.log('start: stroke complete')

    if (!this.runtimeDoc) return
    if (!this.activeLayerEntity) return
    if (this.#state.busy) return

    const updateLock = await this.runtimeDoc.updaterLock.ensure()
    // -- ^ waiting for previous render commit

    this.beforeCommitAborter?.abort()
    this.beforeCommitAborter = new AbortController()

    this.lastRenderAborter?.abort()

    // Not do this, commit is must be completion or failed
    // This aborter is not used
    // const aborter = (this.lastRenderAborter = new AbortController())
    const aborter = new AbortController()

    const tmpctx = await this.tmpctxResource.ensure()
    const dstctx = this.dstctx

    this.setState((d) => (d.busy = true))

    try {
      // clear first, if clear after render, it will cause visually freeze
      tmpctx.clearRect(0, 0, tmpctx.canvas.width, tmpctx.canvas.height)

      RenderCycleLogger.current.time('toSimplefiedPath')
      const path = stroke.toSimplefiedPath()
      RenderCycleLogger.current.timeEnd('toSimplefiedPath')
      RenderCycleLogger.current.info(
        `Path simplified: ${stroke.points.length} -> ${path.points.length}`
      )

      if (this.activeLayerEntity.layerType === 'vector') {
        const obj = this.createVectorObjectByStrokeAndCurrentSettings(stroke)
        this.activeLayerEntity.objects.push(obj)

        // Update layer image data
        setCanvasSize(
          tmpctx.canvas,
          this.dstCanvas.width,
          this.dstCanvas.height
        )

        await this.renderer.renderVectorLayer(
          tmpctx.canvas,
          {
            ...this.activeLayerEntity,
          },
          {
            // abort: aborter.signal,
            viewport: {
              top: 0,
              left: 0,
              width: this.dstCanvas.width,
              height: this.dstCanvas.height,
            },
            logger: RenderCycleLogger.current,
          }
        )

        await this.runtimeDoc.updateOrCreateLayerBitmapCache(
          this.activeLayerEntity.uid,
          tmpctx.getImageData(0, 0, tmpctx.canvas.width, tmpctx.canvas.height)
        )
      } else if (this.activeLayerEntity.layerType === 'raster') {
        if (!this.strokeSetting) return

        const currentBitmap =
          (await this.runtimeDoc.getOrCreateLayerBitmapCache(
            this.activeLayerEntity.uid
          ))!

        setCanvasSize(tmpctx.canvas, currentBitmap.width, currentBitmap.height)

        // Copy current layer image to tmpctx
        tmpctx.clearRect(0, 0, tmpctx.canvas.width, tmpctx.canvas.height)
        tmpctx.drawImage(currentBitmap, 0, 0)

        // Write stroke to current layer
        await this.renderer.renderStroke(
          tmpctx.canvas,
          path,
          this.strokeSetting,
          {
            inkSetting: this.#state.currentInk,
            abort: aborter.signal,
            transform: {
              position: { x: 0, y: 0 },
              scale: { x: 1, y: 1 },
              rotation: 0,
            },
            logger: RenderCycleLogger.current,
          }
        )

        // Update layer image data
        await this.runtimeDoc.updateOrCreateLayerBitmapCache(
          this.activeLayerEntity.uid,
          tmpctx.getImageData(0, 0, currentBitmap.width, currentBitmap.height)
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
            logger: RenderCycleLogger.current,
          }
        )
      } finally {
        RenderCycleLogger.current.printLogs('onUIStrokeComplete')
      }
    } catch (e) {
      if (!(e instanceof PaplicoIgnoreableError)) throw e
    } finally {
      this.runtimeDoc.updaterLock.release(updateLock)
      this.tmpctxResource.release(tmpctx)
      this.setState((d) => (d.busy = false))
    }
  }

  protected createVectorObjectByStrokeAndCurrentSettings(
    stroke: UIStroke
  ): VectorObject {
    const obj = createVectorObject({
      path: stroke.toPath(),
      appearances: [
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

  // public onVectorObjectCreate() {}
}

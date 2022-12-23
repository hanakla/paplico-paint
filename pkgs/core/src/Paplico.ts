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
import { deepClone } from './utils/object'
import {
  VectorAppearance,
  VectorAppearanceFill,
} from './Document/LayerEntity/VectorAppearance'
import { CircleBrush } from './Engine/Brushes/CircleBrush'
import { Emitter } from './utils/Emitter'
import { BrushClass } from './Engine/Brush'
import { logImage } from './utils/DebugHelper'

export namespace Paplico {
  export type StrokeSetting<T extends Record<string, any> = any> =
    VectorStrokeSetting<T>

  export type FillSetting = VectorFillSetting

  export type State = {
    activeLayer: {
      layerType: LayerEntity['layerType']
      layerUid: string
      pathToLayer: string[]
    } | null
    currentStroke: StrokeSetting | null
    currentFill: FillSetting | null
    strokeComposition: 'normal' | 'erase'
    brushEntries: BrushClass[]
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

  public pipeline: MixerPipeline
  public renderer: Renderer
  public uiCanvas: UICanvas

  protected dstCanvas: HTMLCanvasElement
  protected dstctx: CanvasRenderingContext2D
  protected tmp: HTMLCanvasElement
  protected tmpctx: CanvasRenderingContext2D

  protected document: PaplicoDocument | null = null
  protected runtimeDoc: RuntimeDocument | null = null

  // protected activeLayerStatus: | null = null
  protected lastRenderAborter: AbortController | null = null

  #state: Paplico.State = {
    activeLayer: null,
    currentStroke: null,
    currentFill: null,
    strokeComposition: 'normal',
    brushEntries: [],
  }

  #activeLayerEntity: LayerEntity | null = null

  constructor(canvas: HTMLCanvasElement) {
    super()

    this.brushes = new BrushRegistry()
    this.brushes.register(CircleBrush)

    this.pipeline = new MixerPipeline({ brushRegistry: this.brushes, canvas })
    this.renderer = new Renderer({ brushRegistry: this.brushes })
    this.uiCanvas = new UICanvas(canvas).activate()

    this.dstCanvas = canvas
    this.dstctx = canvas.getContext('2d')!

    this.tmp = createCanvas()
    this.tmpctx = this.tmp.getContext('2d', { willReadFrequently: true })!

    this.onUIStrokeChange = singletonCall(this.onUIStrokeChange.bind(this))
    this.onUIStrokeComplete = singletonCall(this.onUIStrokeComplete.bind(this))
    this.initilize()
  }

  /** (Readonly) current editor states */
  public get state() {
    return this.#state
  }

  protected setState(fn: (draft: Draft<Paplico.State>) => void) {
    this.#state = immer(this.#state, fn)
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

    this.lastRenderAborter?.abort()
    this.lastRenderAborter = new AbortController()

    const tmpctx = this.tmp.getContext('2d')!
    const dstctx = this.dstctx

    const path = stroke.toPath()

    if (this.activeLayerEntity.layerType === 'vector') {
      const obj = this.createVectorObjectByStrokeAndCurrentSettings(stroke)

      this.renderer.renderVectorLayer(
        this.tmp,
        {
          ...this.activeLayerEntity,
          objects: [...this.activeLayerEntity.objects, obj],
        },
        {
          abort: this.lastRenderAborter.signal,
          viewport: {
            top: 0,
            left: 0,
            width: this.dstCanvas.width,
            height: this.dstCanvas.height,
          },
        }
      )
    } else if (this.activeLayerEntity.layerType === 'raster') {
      if (!this.strokeSetting) return

      const currentBitmap = (await this.runtimeDoc.getOrCreateLayerBitmapCache(
        this.activeLayerEntity.uid
      ))!

      setCanvasSize(this.tmp, currentBitmap.width, currentBitmap.height)

      // Copy current layer image to tmpctx
      tmpctx.clearRect(0, 0, this.tmp.width, this.tmp.height)
      tmpctx.drawImage(currentBitmap, 0, 0)

      console.log('render stroke')
      // Write stroke to current layer
      await this.renderer.renderStroke(this.tmp, path, this.strokeSetting, {
        abort: this.lastRenderAborter.signal,
        transform: {
          position: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
      })
    } else {
      return
    }

    // Mix current layer to destination
    // this.pipeline.mix(dstctx, tmpctx, {composition: 'normal'})

    // this.destctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    // this.destctx.drawImage(this.tmp, 0, 0)

    try {
      await this.pipeline.fullyRender(dstctx, this.runtimeDoc, this.renderer, {
        override: { [this.activeLayerEntity.uid]: tmpctx.canvas },
        abort: this.lastRenderAborter.signal,
        viewport: {
          top: 0,
          left: 0,
          width: this.dstCanvas.width,
          height: this.dstCanvas.height,
        },
      })
    } finally {
      tmpctx.clearRect(0, 0, this.tmp.width, this.tmp.height)
    }
  }

  protected async onUIStrokeComplete(stroke: UIStroke) {
    if (!this.runtimeDoc) return
    if (!this.activeLayerEntity) return

    this.lastRenderAborter?.abort()
    this.lastRenderAborter = new AbortController()

    const tmpctx = this.tmp.getContext('2d')!
    const dstctx = this.dstctx

    const path = stroke.toSimplefiedPath()

    if (this.activeLayerEntity.layerType === 'vector') {
      const obj = this.createVectorObjectByStrokeAndCurrentSettings(stroke)
      this.activeLayerEntity.objects.push(obj)
    } else if (this.activeLayerEntity.layerType === 'raster') {
      if (!this.strokeSetting) return

      const currentBitmap = (await this.runtimeDoc.getOrCreateLayerBitmapCache(
        this.activeLayerEntity.uid
      ))!

      setCanvasSize(this.tmp, currentBitmap.width, currentBitmap.height)

      // Copy current layer image to tmpctx
      tmpctx.clearRect(0, 0, this.tmp.width, this.tmp.height)
      tmpctx.drawImage(currentBitmap, 0, 0)

      // Write stroke to current layer
      await this.renderer.renderStroke(this.tmp, path, this.strokeSetting, {
        abort: this.lastRenderAborter.signal,
        transform: {
          position: { x: 0, y: 0 },
          scale: { x: 1, y: 1 },
          rotation: 0,
        },
      })

      // Update layer image data
      await this.runtimeDoc.updateLayerBitmapCache(
        this.activeLayerEntity.uid,
        tmpctx.getImageData(0, 0, currentBitmap.width, currentBitmap.height)
      )
    } else {
      return
    }

    try {
      await this.pipeline.fullyRender(dstctx, this.runtimeDoc, this.renderer, {
        abort: this.lastRenderAborter.signal,
        viewport: {
          top: 0,
          left: 0,
          width: this.dstCanvas.width,
          height: this.dstCanvas.height,
        },
      })
    } finally {
      tmpctx.clearRect(0, 0, this.tmp.width, this.tmp.height)
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
              { kind: 'stroke', stroke: deepClone(this.state.currentStroke) },
            ] satisfies VectorAppearance[])
          : []),
      ],
    })

    return obj
  }

  // public onVectorObjectCreate() {}
}

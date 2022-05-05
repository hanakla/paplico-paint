import { fit, position } from 'object-fit-math'
import { PaplicoEngine } from '../Engine3'
import { createContext2D } from '../../Engine3_CanvasFactory'
import { Document, LayerTypes } from '../../DOM'
import {
  createKeyedRequestIdeCallback,
  deepClone,
  setCanvasSize,
} from '../../utils'
import { IRenderStrategy } from './IRenderStrategy'
import { AtomicResource } from '../../AtomicResource'
import { CompositeMode, ILayer } from '../../DOM/ILayer'
import { PapDOMDigger } from '../../PapDOMDigger'
import { workerSafeCanvasToBlob } from '../../PapHelpers'

type Override = {
  layerId: string
  context2d: CanvasRenderingContext2D
  compositeMode: CompositeMode | 'destination-out'
}

export class DifferenceRender implements IRenderStrategy {
  private bitmapCache: WeakMap<LayerTypes, Uint8ClampedArray> = new WeakMap()
  // private layerLastUpdateTimes = new WeakMap<LayerTypes, number>()
  private needsUpdateLayerIds: { [layerId: string]: true | undefined } = {}
  private overrides: Override | null = null

  private bufferCtx: AtomicResource<CanvasRenderingContext2D>
  private atomicPreviewCtx: AtomicResource<CanvasRenderingContext2D>
  private convertCtx = createContext2D()
  private previews: { [layerId: string]: string } = Object.create(null)

  private keyedRequestIdleCallback = createKeyedRequestIdeCallback()

  constructor() {
    const bufferCtx = createContext2D()
    this.bufferCtx = new AtomicResource(bufferCtx)
    // document.body.appendChild(bufferCtx.canvas)

    const previewCtx = createContext2D()
    setCanvasSize(previewCtx.canvas, 100, 100)
    this.atomicPreviewCtx = new AtomicResource(previewCtx)
    // previewCtx.canvas.id = 'preview-canvas-difference-render'
    // document.body.appendChild(previewCtx.canvas)
  }

  public get renderScale() {
    return 1
  }

  public getPreiewForLayer(uid: string) {
    return this.previews[uid]
  }

  public markUpdatedLayerId(layerId: string) {
    this.needsUpdateLayerIds[layerId] = true
  }

  public setLayerOverride(override: Override | null) {
    this.overrides = override
  }

  public async dispose() {
    const ctx = await this.bufferCtx.enjure()

    // Freeing memory for Safari
    // See: https://stackoverflow.com/questions/52532614/total-canvas-memory-use-exceeds-the-maximum-limit-safari-12
    setCanvasSize(ctx.canvas, 0, 0)
    setCanvasSize((await this.atomicPreviewCtx.enjure()).canvas, 0, 0)

    this.bufferCtx = null!
  }

  public async render(
    engine: PaplicoEngine,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    const bufferCtx = await this.bufferCtx.enjure({ owner: this })

    setCanvasSize(bufferCtx.canvas, document.width, document.height)

    type LayerBitmapResult = {
      layer: LayerTypes
      needsUpdate: boolean
      image: ImageBitmap | null
      subResults?: Omit<LayerBitmapResult, 'subResults'>[]
    }

    const referencedLayers = new Map()
    PapDOMDigger.traverseLayers(document, { kind: 'reference' }, (layer) => {
      referencedLayers.set(
        layer.uid,
        PapDOMDigger.findLayerRecursive(document, layer.referencedLayerId, {
          strict: false,
        })
      )
    })

    const getLayerBitmap = async (
      layer: LayerTypes,
      ignoreVisibility: boolean = false
    ): Promise<LayerBitmapResult> => {
      if (!layer.visible && !ignoreVisibility)
        return { layer, needsUpdate: false, image: null }

      // Needs rerender
      switch (layer.layerType) {
        case 'group': {
          const results: Omit<LayerBitmapResult, 'subResults'>[] = []

          for (const subLayer of layer.layers) {
            const result = await getLayerBitmap(subLayer)
            results.push(result)
          }

          return {
            layer,
            needsUpdate: results.some((r) => r.needsUpdate),
            image: null,
            subResults: results,
          }
        }
        case 'vector': {
          let bitmap = this.needsUpdateLayerIds[layer.uid]
            ? null
            : this.bitmapCache.get(layer)

          bitmap ??= await engine.renderVectorLayer(document, layer)
          this.bitmapCache.set(layer, bitmap)

          let image = await createImageBitmap(
            new ImageData(bitmap, document.width, document.height)
          )

          this.keyedRequestIdleCallback(layer.uid, () => {
            this.setPreviewForLayer(layer, document, image)
          })

          return {
            layer,
            needsUpdate: !!this.needsUpdateLayerIds[layer.uid],
            image,
          }
        }
        case 'raster': {
          const image = await layer.imageBitmap

          this.keyedRequestIdleCallback(layer.uid, () => {
            this.setPreviewForLayer(layer, document, image)
          })

          return {
            layer,
            needsUpdate: !!this.needsUpdateLayerIds[layer.uid],
            image,
          }
        }
        case 'filter': {
          return { layer, needsUpdate: false, image: null }
        }
        case 'text': {
          return { layer, needsUpdate: false, image: null }
        }
        case 'reference': {
          if (layer.uid === layer.referencedLayerId)
            return { layer, needsUpdate: false, image: null }

          const referenced = referencedLayers.get(layer.uid)
          const result = referenced
            ? await getLayerBitmap(referenced, true)
            : null
          return result
            ? { layer, needsUpdate: result.needsUpdate, image: result.image }
            : { layer, needsUpdate: false, image: null }
        }
      }
    }

    const handleLayerBitmapRequest = async (layerUid: string) => {
      const layer = PapDOMDigger.findLayerRecursive(document, layerUid)
      if (!layer) return { missing: true } as const

      return {
        missing: false,
        image: (await getLayerBitmap(layer, true)).image!,
      } as const
    }

    const layerBitmaps = await Promise.all(
      [...document.layers].reverse().map(async (layer) => getLayerBitmap(layer))
    )

    const compositeTo = async (
      { layer, image, subResults }: LayerBitmapResult,
      dest: CanvasRenderingContext2D
    ) => {
      if (!layer.visible) return

      setCanvasSize(bufferCtx.canvas, document.getLayerSize(layer))
      bufferCtx.clearRect(0, 0, document.width, document.height)

      // Apply FilterLayer
      if (image == null && layer.layerType === 'filter') {
        // TODO
        // if (disableAllFilters) continue

        for (const filter of layer.filters) {
          if (!filter.visible) continue

          const instance = engine.toolRegistry.getFilterInstance(
            filter.filterId
          )

          if (!instance)
            throw new Error(`Filter not found (id:${filter.filterId})`)

          await engine.applyFilter(destCtx, bufferCtx, instance, {
            layer: layer,
            size: { width: document.width, height: document.height },
            filterSettings: deepClone(filter.settings),
            handleLayerBitmapRequest,
          })

          await engine.compositeLayers(bufferCtx, destCtx, {
            mode: layer.compositeMode,
            opacity: layer.opacity,
          })
        }

        return
      }

      if (image == null && layer.layerType === 'group' && subResults) {
        // Isolated group
        if (layer.compositeIsolation) {
          for (const r of subResults) {
            await compositeTo(r, dest)
          }

          return
        } else {
          const groupCtx = createContext2D()
          setCanvasSize(groupCtx.canvas, document.getLayerSize(layer))

          for (const r of subResults) {
            await compositeTo(r, groupCtx)
          }

          await engine.compositeLayers(groupCtx, destCtx, {
            mode: layer.compositeMode,
            opacity: layer.opacity,
          })

          setCanvasSize(groupCtx.canvas, 0, 0)
        }
      }

      if (image == null) return

      // TODO: layer.{x,y} 対応
      bufferCtx.drawImage(image, layer.x, layer.y)

      if (this.overrides?.layerId === layer.uid) {
        await engine.compositeLayers(this.overrides.context2d, bufferCtx, {
          mode: this.overrides.compositeMode,
          opacity: layer.opacity,
        })
      }

      for (const filter of layer.filters) {
        if (!filter.visible) continue
        // if (disableAllFilters) continue

        const instance = engine.toolRegistry.getFilterInstance(filter.filterId)!
        if (!instance)
          throw new Error(`Filter not found (id:${filter.filterId})`)

        await engine.applyFilter(bufferCtx, bufferCtx, instance, {
          layer,
          size: { width: document.width, height: document.height },
          filterSettings: deepClone(filter.settings),
          handleLayerBitmapRequest,
        })
      }

      await engine.compositeLayers(bufferCtx, destCtx, {
        mode: 'normal', // layer.compositeMode,
        opacity: layer.opacity,
      })
    }

    // Composite layers
    try {
      for (const result of layerBitmaps) {
        await compositeTo(result, destCtx)
      }

      this.needsUpdateLayerIds = {}
    } catch (e) {
      throw e
    } finally {
      this.bufferCtx.release(bufferCtx)
    }
  }

  private async setPreviewForLayer(
    layer: LayerTypes,
    document: Document,
    bitmap: ImageBitmap
  ) {
    return
    const ctx = await this.atomicPreviewCtx.enjure({ owner: this })
    const c = ctx.canvas

    try {
      const layerSize = document.getLayerSize(layer)
      setCanvasSize(this.convertCtx.canvas, document.getLayerSize(layer))
      this.convertCtx.drawImage(bitmap, 0, 0)

      const pos = position(c, layerSize, 'center', 'center')
      const size = fit(c, layerSize, 'contain')

      ctx.clearRect(0, 0, c.width, c.height)
      ctx.drawImage(
        this.convertCtx.canvas,
        pos.x,
        pos.y,
        size.width,
        size.height
      )

      const blob = await workerSafeCanvasToBlob(c, { type: 'image/png' })

      if (this.previews[layer.uid])
        URL.revokeObjectURL(this.previews[layer.uid])
      this.previews[layer.uid] = URL.createObjectURL(blob)
    } finally {
      this.atomicPreviewCtx.release(ctx)
      setCanvasSize(this.convertCtx.canvas, 0, 0)
    }

    // const bufferCtx = await this.bufferCtx.enjure({ owner: this })
    // setCanvasSize(bufferCtx.canvas, 100, 100)
    // try {
    //   for (const entry of layerBitmaps) {
    //     if (
    //       entry.layer.layerType !== 'raster' &&
    //       entry.layer.layerType !== 'vector'
    //     )
    //       return
    //     if (!entry.image) return
    //     if (entry.needsUpdate === false) return
    //     const { width, height } = document.getLayerSize(entry.layer)
    //     setCanvasSize(this.previewCtx.canvas, width, height)
    //     this.previewCtx.clearRect(0, 0, width, height)
    //     bufferCtx.clearRect(
    //       0,
    //       0,
    //       bufferCtx.canvas.width,
    //       bufferCtx.canvas.height
    //     )
    //     this.previewCtx.putImageData(entry.image, 0, 0)
    //     bufferCtx.drawImage(this.previewCtx.canvas, 0, 0, 100, 100)
    //     const blob = await new Promise<Blob | null>((r) =>
    //       bufferCtx.canvas.toBlob(r, 'image/png')
    //     )
    //     if (this.previews[entry.layer.uid])
    //       URL.revokeObjectURL(this.previews[entry.layer.uid])
    //     this.previews[entry.layer.uid] = URL.createObjectURL(blob!)
    //   }
    // } finally {
    //   this.bufferCtx.release(bufferCtx)
    // }
  }
}

import { SilkEngine3 } from '../Engine3'
import { createContext2D } from '../../Engine3_CanvasFactory'
import { Document, LayerTypes } from '../../SilkDOM'
import { deepClone, setCanvasSize } from '../../utils'
import { IRenderStrategy } from './IRenderStrategy'
import { AtomicResource } from '../../AtomicResource'
import { CompositeMode } from '../../SilkDOM/IRenderable'
import { SilkDOMDigger } from '../../SilkDOMDigger'

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
  private previewCtx: CanvasRenderingContext2D
  private previews: { [layerId: string]: string } = Object.create(null)

  constructor() {
    const bufferCtx = createContext2D()
    this.bufferCtx = new AtomicResource(bufferCtx)
    // document.body.appendChild(bufferCtx.canvas)

    const previewCtx = createContext2D()
    setCanvasSize(previewCtx.canvas, 100, 100)
    this.previewCtx = previewCtx
    previewCtx.canvas.id = 'preview-canvas-difference-render'
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

  public async render(
    engine: SilkEngine3,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    const bufferCtx = await this.bufferCtx.enjure({ owner: this })

    setCanvasSize(bufferCtx.canvas, document.width, document.height)

    type LayerBitmapResult = {
      layer: LayerTypes
      needsUpdate: boolean
      image: ImageData | null
      subResults?: Omit<LayerBitmapResult, 'subResults'>[]
    }

    const referencedLayers = new Map()
    SilkDOMDigger.traverseLayers(document, { kind: 'reference' }, (layer) => {
      referencedLayers.set(
        layer.uid,
        SilkDOMDigger.findLayerRecursive(document, layer.referencedLayerId, {
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

          return {
            layer,
            needsUpdate: !!this.needsUpdateLayerIds[layer.uid],
            image: new ImageData(bitmap, document.width, document.height),
          }
        }
        case 'raster': {
          return {
            layer,
            needsUpdate: !!this.needsUpdateLayerIds[layer.uid],
            image: new ImageData(layer.bitmap, layer.width, layer.height),
          }
        }
        case 'filter': {
          return { layer, needsUpdate: false, image: null }
        }
        case 'text': {
          return { layer, needsUpdate: false, image: null }
        }
        case 'reference': {
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
            size: { width: document.width, height: document.height },
            filterSettings: deepClone(filter.settings),
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
      bufferCtx.putImageData(image, layer.x, layer.y)

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
          size: { width: document.width, height: document.height },
          filterSettings: deepClone(filter.settings),
        })
      }

      await engine.compositeLayers(bufferCtx, destCtx, {
        mode: layer.compositeMode,
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

    // Generate thumbnails
    setTimeout(async () => {
      return

      const bufferCtx = await this.bufferCtx.enjure({ owner: this })
      setCanvasSize(bufferCtx.canvas, 100, 100)

      try {
        for (const entry of layerBitmaps) {
          if (
            entry.layer.layerType !== 'raster' &&
            entry.layer.layerType !== 'vector'
          )
            return
          if (!entry.image) return
          if (entry.needsUpdate === false) return

          const { width, height } = document.getLayerSize(entry.layer)
          setCanvasSize(this.previewCtx.canvas, width, height)
          this.previewCtx.clearRect(0, 0, width, height)

          bufferCtx.clearRect(
            0,
            0,
            bufferCtx.canvas.width,
            bufferCtx.canvas.height
          )

          this.previewCtx.putImageData(entry.image, 0, 0)
          bufferCtx.drawImage(this.previewCtx.canvas, 0, 0, 100, 100)

          const blob = await new Promise<Blob | null>((r) =>
            bufferCtx.canvas.toBlob(r, 'image/png')
          )

          if (this.previews[entry.layer.uid])
            URL.revokeObjectURL(this.previews[entry.layer.uid])
          this.previews[entry.layer.uid] = URL.createObjectURL(blob!)
        }
      } finally {
        this.bufferCtx.release(bufferCtx)
      }
    }, 100)
  }

  public dispose() {
    this.bufferCtx = null!
  }
}

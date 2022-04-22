import { Document, LayerTypes } from '../../SilkDOM'
import { IRenderStrategy } from './IRenderStrategy'
import { SilkEngine3 } from '../Engine3'
import { assign, deepClone, setCanvasSize } from '../../utils'
import { createContext2D } from '../../Engine3_CanvasFactory'
import { SilkDOMDigger } from '../../SilkDOMDigger'

export class FullRender implements IRenderStrategy {
  private bufferCtx: CanvasRenderingContext2D

  constructor() {
    this.bufferCtx = createContext2D()
  }

  public get renderScale() {
    return 1
  }

  public async dispose() {
    // Freeing memory for Safari
    // See: https://stackoverflow.com/questions/52532614/total-canvas-memory-use-exceeds-the-maximum-limit-safari-12
    setCanvasSize(this.bufferCtx.canvas, 0, 0)
  }

  public async render(
    engine: SilkEngine3,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    const { bufferCtx } = this
    setCanvasSize(bufferCtx.canvas, document.width, document.height)

    type LayerBitmapResult = {
      layer: LayerTypes
      image: ImageData | null
      subResults?: Omit<LayerBitmapResult, 'subResults'>[]
    }

    const referencedLayers = new Map()
    SilkDOMDigger.traverseLayers(document, { kind: 'reference' }, (layer) => {
      referencedLayers.set(
        layer.uid,
        SilkDOMDigger.findLayerRecursive(document, layer.referencedLayerId, {
          strict: true,
        })
      )
    })

    const getLayerBitmap = async (
      layer: LayerTypes,
      ignoreVisibility: boolean = false
    ): Promise<LayerBitmapResult> => {
      if (!layer.visible && !ignoreVisibility) return { layer, image: null }

      switch (layer.layerType) {
        case 'group': {
          const results: Omit<LayerBitmapResult, 'subResults'>[] = []

          for (const subLayer of layer.layers) {
            const result = await getLayerBitmap(subLayer)
            results.push(result)
          }

          return {
            layer,
            image: null,
            subResults: results,
          }
        }
        case 'vector': {
          let bitmap = await engine.renderVectorLayer(document, layer)

          return {
            layer,
            image: new ImageData(bitmap, document.width, document.height),
          }
        }
        case 'raster': {
          return {
            layer,
            image: new ImageData(layer.bitmap, layer.width, layer.height),
          }
        }
        case 'filter': {
          return { layer, image: null }
        }
        case 'text': {
          return { layer, image: null }
        }
        case 'reference': {
          const referenced = referencedLayers.get(layer.uid)!
          return {
            layer,
            image: (await getLayerBitmap(referenced, true)).image,
          }
        }
      }
    }

    const layerBitmaps = await Promise.all(
      [...document.layers].reverse().map(async (layer) => getLayerBitmap(layer))
    )

    bufferCtx.save()

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
            layer,
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
        })
      }

      await engine.compositeLayers(bufferCtx, destCtx, {
        mode: layer.compositeMode,
        opacity: layer.opacity,
      })
    }

    try {
      for (const result of layerBitmaps) {
        await compositeTo(result, destCtx)
      }
    } catch (e) {
      throw e
    } finally {
      // this.atomicBufferCtx.release(bufferCtx)
      // this.canvasHandler.context.restore()
      // this.atomicRender.release(renderLock)
    }
  }
}

import { Document, LayerTypes } from '../../DOM'
import { IRenderStrategy } from './IRenderStrategy'
import { PaplicoEngine } from '../Engine3'
import { setCanvasSize } from '../../utils'
import { deepClone } from '../../utils/object'
import { createContext2D } from '../../Engine3_CanvasFactory'
import { PapDOMDigger } from '../../PapDOMDigger'
import { Emitter } from '../../Engine3_Emitter'
import { workerSafeCanvasToBlob } from '../../PapHelpers'

type Events = {
  rootLayerRendered: void
}

export class LayerSpreadRenderer
  extends Emitter<Events>
  implements IRenderStrategy
{
  private bufferCtx: CanvasRenderingContext2D
  private rootLayerResultBlobs: Map<string, { blob: Blob; layer: LayerTypes }> =
    new Map()

  constructor(private exportType: string, private exportQuality?: number) {
    super()
    this.bufferCtx = createContext2D()
  }

  public get renderScale() {
    return 1
  }

  public async dispose() {
    // Freeing memory for Safari
    // See: https://stackoverflow.com/questions/52532614/total-canvas-memory-use-exceeds-the-maximum-limit-safari-12
    setCanvasSize(this.bufferCtx.canvas, 0, 0)
    this.rootLayerResultBlobs.clear()
  }

  public async render(
    engine: PaplicoEngine,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    const { bufferCtx } = this
    setCanvasSize(bufferCtx.canvas, document.width, document.height)

    type LayerBitmapResult = {
      layer: LayerTypes
      image: ImageBitmap | null // ImageData | null
      isRootLayer: boolean
      subResults?: Omit<LayerBitmapResult, 'subResults'>[]
    }

    const referencedLayers = new Map()
    PapDOMDigger.traverseLayers(document, { kind: 'reference' }, (layer) => {
      referencedLayers.set(
        layer.uid,
        PapDOMDigger.findLayerRecursive(document, layer.referencedLayerId, {})
      )
    })

    const getLayerBitmap = async (
      layer: LayerTypes,
      ignoreVisibility: boolean = false,
      depth: number = 0
    ): Promise<LayerBitmapResult> => {
      const isRootLayer = depth === 0

      if (!layer.visible && !ignoreVisibility && !isRootLayer)
        return { layer, image: null, isRootLayer }

      switch (layer.layerType) {
        case 'group': {
          const results: Omit<LayerBitmapResult, 'subResults'>[] = []

          for (const subLayer of layer.layers) {
            const result = await getLayerBitmap(subLayer, false, depth + 1)
            results.push(result)
          }

          return {
            layer,
            image: null,
            subResults: results,
            isRootLayer,
          }
        }
        case 'vector': {
          let bitmap = await engine.renderVectorLayer(document, layer)
          let image = await createImageBitmap(
            new ImageData(bitmap, document.width, document.height)
          )

          return {
            layer,
            image,
            isRootLayer,
          }
        }
        case 'raster': {
          return {
            layer,
            image: await layer.imageBitmap,
            isRootLayer,
          }
        }
        case 'filter': {
          return { layer, image: null, isRootLayer }
        }
        case 'text': {
          return { layer, image: null, isRootLayer }
        }
        case 'reference': {
          if (layer.uid === layer.referencedLayerId)
            return { layer, image: null, isRootLayer }

          const referenced = referencedLayers.get(layer.uid)!
          return {
            layer,
            image: (await getLayerBitmap(referenced, true, depth + 1)).image,
            isRootLayer,
          }
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

    bufferCtx.save()

    const compositeTo = async (
      { layer, image, subResults, isRootLayer }: LayerBitmapResult,
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

      if (isRootLayer) {
        const blob = await workerSafeCanvasToBlob(bufferCtx.canvas, {
          type: this.exportType,
          quality: this.exportQuality,
        })

        this.rootLayerResultBlobs.set(layer.uid, { blob, layer })
      }

      await engine.compositeLayers(bufferCtx, destCtx, {
        mode: layer.compositeMode,
        opacity: layer.opacity,
      })
    }

    for (const result of layerBitmaps) {
      await compositeTo(result, destCtx)
    }
  }

  public getRootLayerResults() {
    return [...this.rootLayerResultBlobs].map(
      ([uid, { blob, layer }], index) => ({
        uid,
        blob,
        index,
        compositeMode: layer.compositeMode,
        opacity: layer.opacity,
      })
    )
  }
}

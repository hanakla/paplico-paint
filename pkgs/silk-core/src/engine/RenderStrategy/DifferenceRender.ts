import { SilkEngine3 } from 'engine/Engine3'
import { Document, LayerTypes } from 'Entity'
import { assign, deepClone } from '../../utils'
import { IRenderStrategy } from './IRenderStrategy'

export class DifferenceRender implements IRenderStrategy {
  private bufferCtx: CanvasRenderingContext2D
  private bitmapCache: WeakMap<LayerTypes, Uint8ClampedArray> = new WeakMap()
  // private layerLastUpdateTimes = new WeakMap<LayerTypes, number>()
  private needsUpdateLayerIds: string[] = []
  private overrides: { layerId: string; canvas: HTMLCanvasElement } | null =
    null

  constructor() {
    this.bufferCtx = document.createElement('canvas').getContext('2d')!
    this.bufferCtx.canvas.style.setProperty('background', 'rgba(255,0,0,.5)')
    document.body.appendChild(this.bufferCtx.canvas)
  }

  public markUpdatedLayerId(layerId: string) {
    this.needsUpdateLayerIds.push(layerId)
  }

  public setLayerOverride(
    override: { layerId: string; canvas: HTMLCanvasElement } | null
  ) {
    this.overrides = override
  }

  async render(
    engine: SilkEngine3,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    const { bufferCtx } = this
    assign(bufferCtx.canvas, { width: document.width, height: document.height })

    const layerBitmaps = await Promise.all(
      [...document.layers].map(async (layer) => {
        if (!layer.visible)
          return { layer, needsUpdate: false, image: null } as const

        // if (!this.needsUpdateLayers.includes(layer.id))
        //   return { layer, image: null } as const

        // Needs rerender
        switch (layer.layerType) {
          case 'vector': {
            const bitmap =
              this.bitmapCache.get(layer) ??
              (await engine.renderVectorLayer(document, layer))

            return {
              layer,
              needsUpdate: this.needsUpdateLayerIds.includes(layer.id),
              image: new ImageData(bitmap, document.width, document.height),
            } as const
          }
          case 'raster': {
            return {
              layer,
              needsUpdate: this.needsUpdateLayerIds.includes(layer.id),
              image: new ImageData(layer.bitmap, layer.width, layer.height),
            } as const
          }
          case 'filter': {
            return { layer, needsUpdate: false, image: null }
          }
          case 'text': {
            return { layer, needsUpdate: false, image: null }
          }
        }
      })
    )

    // Composite layers
    try {
      for (const { layer, image } of layerBitmaps) {
        if (!layer.visible) continue

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

          continue
        }

        if (image == null) continue

        // TODO: layer.{x,y} 対応
        bufferCtx.putImageData(image, 0, 0)

        if (this.overrides?.layerId === layer.id) {
          bufferCtx.drawImage(this.overrides.canvas, 0, 0)
        }

        for (const filter of layer.filters) {
          if (!filter.visible) continue
          // if (disableAllFilters) continue

          const instance = engine.toolRegistry.getFilterInstance(
            filter.filterId
          )!
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

      // destCtx.clearRect(0, 0, document.width, document.height)
      // destCtx.drawImage(destCtx.canvas, 0, 0)

      this.needsUpdateLayerIds = []
    } catch (e) {
      throw e
    }
  }

  public dispose() {
    this.bufferCtx = null!
  }
}

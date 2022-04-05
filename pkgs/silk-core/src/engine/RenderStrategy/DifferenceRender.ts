import { SilkEngine3 } from '../Engine3'
import { createContext2D } from '../Engine3_CanvasFactory'
import { Document, LayerTypes } from '../../SilkDOM'
import { assign, AtomicResource, deepClone } from '../../utils'
import { IRenderStrategy } from './IRenderStrategy'

export class DifferenceRender implements IRenderStrategy {
  private bitmapCache: WeakMap<LayerTypes, Uint8ClampedArray> = new WeakMap()
  // private layerLastUpdateTimes = new WeakMap<LayerTypes, number>()
  private needsUpdateLayerIds: { [layerId: string]: true | undefined } = {}
  private overrides: { layerId: string; canvas: HTMLCanvasElement } | null =
    null

  private bufferCtx: AtomicResource<CanvasRenderingContext2D>
  private previewCtx: CanvasRenderingContext2D
  private previews: { [layerId: string]: string } = Object.create(null)

  constructor() {
    const bufferCtx = createContext2D()
    this.bufferCtx = new AtomicResource(bufferCtx)
    // document.body.appendChild(bufferCtx.canvas)

    const previewCtx = createContext2D()
    assign(previewCtx.canvas, { width: 100, height: 100 })
    this.previewCtx = previewCtx
    previewCtx.canvas.id = 'preview-canvas-difference-render'
    // document.body.appendChild(previewCtx.canvas)
  }

  public getPreiewForLayer(uid: string) {
    return this.previews[uid]
  }

  public markUpdatedLayerId(layerId: string) {
    this.needsUpdateLayerIds[layerId] = true
  }

  public setLayerOverride(
    override: { layerId: string; canvas: HTMLCanvasElement } | null
  ) {
    this.overrides = override
  }

  public async render(
    engine: SilkEngine3,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    const bufferCtx = await this.bufferCtx.enjure({ owner: this })

    assign(bufferCtx.canvas, { width: document.width, height: document.height })

    const layerBitmaps = await Promise.all(
      [...document.layers].map(async (layer) => {
        if (!layer.visible)
          return { layer, needsUpdate: false, image: null } as const

        // if (!this.needsUpdateLayers.includes(layer.uid))
        //   return { layer, image: null } as const

        // Needs rerender
        switch (layer.layerType) {
          case 'vector': {
            let bitmap = this.needsUpdateLayerIds[layer.uid]
              ? null
              : this.bitmapCache.get(layer)

            bitmap ??= await engine.renderVectorLayer(document, layer)

            return {
              layer,
              needsUpdate: !!this.needsUpdateLayerIds[layer.uid],
              image: new ImageData(bitmap, document.width, document.height),
            } as const
          }
          case 'raster': {
            return {
              layer,
              needsUpdate: !!this.needsUpdateLayerIds[layer.uid],
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

        assign(bufferCtx.canvas, document.getLayerSize(layer))
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

        if (this.overrides?.layerId === layer.uid) {
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

      this.needsUpdateLayerIds = {}
    } catch (e) {
      throw e
    } finally {
      console.log('completed')
      this.bufferCtx.release(bufferCtx)
    }

    // Generate thumbnails
    setTimeout(async () => {
      const bufferCtx = await this.bufferCtx.enjure({ owner: this })
      assign(bufferCtx.canvas, {
        width: 100,
        height: 100,
      })

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
          assign(this.previewCtx.canvas, { width, height })
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

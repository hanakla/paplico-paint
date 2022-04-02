import { Document } from '../../Entity'
import { IRenderStrategy } from './IRenderStrategy'
import { SilkEngine3 } from '../Engine3'
import { assign, deepClone } from '../../utils'

export class FullRender implements IRenderStrategy {
  private bufferCtx: CanvasRenderingContext2D

  constructor() {
    this.bufferCtx = document.createElement('canvas').getContext('2d')!
  }

  public async render(
    engine: SilkEngine3,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    const { bufferCtx } = this
    // const destCtx = window.document.createElement('canvas').getContext('2d')!
    assign(bufferCtx.canvas, {
      width: document.width,
      height: document.height,
    })

    const layerBitmaps = await Promise.all(
      [...document.layers].map(async (layer) => {
        if (!layer.visible) return [layer.id, layer, null] as const

        switch (layer.layerType) {
          case 'vector': {
            const bitmap = await engine.renderVectorLayer(document, layer)

            return [
              layer.id,
              layer,
              new ImageData(bitmap, document.width, document.height),
            ] as const
          }
          case 'raster': {
            // if (
            //   this.canvasHandler.stroking &&
            //   layer.id === this._activeLayer?.id
            // )
            //   return [layer.id, layer, null] as const

            return [
              layer.id,
              layer,
              new ImageData(layer.bitmap, layer.width, layer.height),
            ] as const
          }
          case 'filter': {
            return [layer.id, layer, null] as const
          }
          case 'text': {
            return [layer.id, layer, null] as const
          }
        }
      })
    )

    bufferCtx.save()

    try {
      for (const [, layer, image] of layerBitmaps) {
        if (!layer.visible) continue

        bufferCtx.clearRect(0, 0, document.width, document.height)

        if (image == null) {
          // if (
          //   this.canvasHandler.stroking &&
          //   layer.id === this._activeLayer?.id
          // ) {
          //   destCtx.globalCompositeOperation = layer.compositeMode
          //   destCtx.globalAlpha = Math.max(0, Math.min(layer.opacity / 100, 1))
          //   destCtx.drawImage(this.strokingPreviewCtx.canvas, 0, 0)

          //   continue
          // } else

          if (layer.layerType === 'filter') {
            // TODO
            // if (disableAllFilters) continue

            for (const filter of layer.filters) {
              if (!filter.visible) continue

              const instance = engine.toolRegistry.getFilterInstance(
                filter.filterId
              )!
              if (!instance)
                throw new Error(`Filter not found (id:${filter.filterId})`)

              destCtx.save()
              bufferCtx.save()

              try {
                instance.render({
                  gl: engine.gl,
                  source: destCtx.canvas,
                  dest: bufferCtx.canvas,
                  size: { width: document.width, height: document.height },
                  settings: deepClone(filter.settings),
                })
              } catch (e) {
                throw e
              } finally {
                destCtx.restore()
                bufferCtx.restore()
              }

              destCtx.globalCompositeOperation =
                layer.compositeMode === 'normal'
                  ? 'source-over'
                  : layer.compositeMode
              destCtx.globalAlpha = Math.max(
                0,
                Math.min(layer.opacity / 100, 1)
              )
              destCtx.drawImage(bufferCtx.canvas, 0, 0)
            }

            continue
          }
        }

        if (image == null) continue

        // TODO: layer.{x,y} 対応
        bufferCtx.putImageData(image, 0, 0)

        for (const filter of layer.filters) {
          if (!filter.visible) continue
          // if (disableAllFilters) continue

          const instance = engine.toolRegistry.getFilterInstance(
            filter.filterId
          )!
          if (!instance)
            throw new Error(`Filter not found (id:${filter.filterId})`)

          bufferCtx.save()
          try {
            instance.render({
              gl: engine.gl,
              source: bufferCtx.canvas,
              dest: bufferCtx.canvas,
              size: { width: document.width, height: document.height },
              settings: deepClone(filter.settings),
            })
          } catch (e) {
            throw e
          } finally {
            bufferCtx.restore()
          }
        }

        destCtx.globalCompositeOperation =
          layer.compositeMode === 'normal' ? 'source-over' : layer.compositeMode
        destCtx.globalAlpha = Math.max(0, Math.min(layer.opacity / 100, 1))
        destCtx.drawImage(bufferCtx.canvas, 0, 0)
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

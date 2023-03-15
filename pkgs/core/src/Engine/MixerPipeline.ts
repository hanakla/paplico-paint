import { CompositeMode, PaplicoDocument } from '@/Document'
import { saveAndRestoreCanvas, setCanvasSize } from '@/utils/canvas'
import { imageSourceToBlob } from '@/utils/DebugHelper'
import { rescue } from '@/utils/resque'
import { BrushRegistry } from './BrushRegistry'
import { createCanvas } from './CanvasFactory'
import { RenderCycleLogger } from './RenderCycleLogger'
import { Renderer } from './Renderer'
import { RuntimeDocument } from './RuntimeDocument'
import { Viewport } from './types'

export class MixerPipeline {
  protected brushRegistry: BrushRegistry
  protected canvas: HTMLCanvasElement

  constructor(options: {
    brushRegistry: BrushRegistry
    canvas: HTMLCanvasElement
  }) {
    this.brushRegistry = options.brushRegistry
    this.canvas = options.canvas
  }

  // public setDocument(doc: PaplicoDocument) {
  //   this.runtimeDoc = new RuntimeDocument(doc)
  // }

  public mix(
    dest: CanvasRenderingContext2D,
    input: CanvasRenderingContext2D,
    options: { composition: 'normal' | 'erase' }
  ) {
    dest.drawImage(input.canvas, 0, 0)
  }

  public async fullyRender(
    dest: CanvasRenderingContext2D,
    doc: RuntimeDocument,
    render: Renderer,
    {
      abort,
      viewport,
      override,
      logger,
    }: {
      abort?: AbortSignal
      viewport: Viewport
      override?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
      logger: RenderCycleLogger
    }
  ) {
    const tmp = createCanvas()
    const tmpctx = tmp.getContext('2d')!
    setCanvasSize(tmp, viewport)

    logger.group('MixerPipeline.fullyRender')
    logger.log('Destination canvas', dest.canvas)
    dest.clearRect(0, 0, dest.canvas.width, dest.canvas.height)
    logger.log('Clear dest canvas')

    for (const node of doc.rootNodes) {
      const layer = doc.resolveLayer(node.layerUid)

      if (!layer) {
        logger.error('Bad layer link', node.layerUid)
        continue
      }

      logger.log('Render layer', layer.uid, layer.name, layer.layerType)

      let image: ImageBitmap | HTMLCanvasElement | null | void

      if (override?.[layer.uid]) {
        image = override[layer.uid]
      } else if (layer.layerType === 'raster') {
        image = (await doc.getOrCreateLayerBitmapCache(layer.uid))!
      } else if (layer.layerType === 'vector') {
        const requestSize = { width: viewport.width, height: viewport.height }

        if (doc.hasLayerBitmapCache(layer.uid, requestSize)) {
          logger.info('Use cached bitmap for vector layer', layer.uid)
          image = (await doc.getOrCreateLayerBitmapCache(
            layer.uid,
            requestSize
          ))!
        } else {
          logger.info('Cache is invalidated, re-render vector layer', layer.uid)

          await render.renderVectorLayer(tmp, layer, {
            viewport,
            abort,
            logger,
          })

          image = await doc.updateOrCreateLayerBitmapCache(
            layer.uid,
            tmpctx.getImageData(0, 0, viewport.width, viewport.height)
          )
        }
      } else {
        // TODO
        continue
      }

      const mode = layerCompositeModeToCanvasCompositeMode(layer.compositeMode)

      await saveAndRestoreCanvas(dest, async () => {
        logger.log(
          `Will draw layer ${layer.uid} as ${mode} to destination.`,
          image
        )
        dest.globalCompositeOperation = mode
        const result = rescue(() => dest.drawImage(image!, 0, 0))
        rescue.isFailure(result) &&
          logger.error('drawImage error', result.error)

        // const img = await imageSourceToBlob(image!)
        // logger.log(
        //   `image: %o %c+`,
        //   img.imageUrl,
        //   `font-size: 0px; padding: 64px; color: transparent; background: url(${img.imageUrl}) center/contain no-repeat; border: 1px solid #444;`,
        //   ''
        // )
      })
    }

    logger.groupEnd()
  }

  // public async render() {}

  // public async renderVector() {}
}

const layerCompositeModeToCanvasCompositeMode = (mode: CompositeMode) =>
  ((
    {
      normal: 'source-over',
      clipper: 'destination-in',
      multiply: 'multiply',
      overlay: 'overlay',
      screen: 'screen',
    } as { [k in CompositeMode]: GlobalCompositeOperation }
  )[mode])

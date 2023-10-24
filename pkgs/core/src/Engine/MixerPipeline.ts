import { CompositeMode, PaplicoDocument } from '@/Document'
import {
  freeingCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { imageSourceToBlob } from '@/utils/DebugHelper'
import { rescue } from '@/utils/resque'
import { BrushRegistry } from './Registry/BrushRegistry'
import { createCanvas } from './CanvasFactory'
import { RenderCycleLogger } from './RenderCycleLogger'
import { RenderPhase, Renderer } from './Renderer'
import { RuntimeDocument } from './RuntimeDocument'
import { Viewport } from './types'
import { PaplicoAbortError } from '@/Errors'

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

  public mix(
    dest: CanvasRenderingContext2D,
    input: CanvasRenderingContext2D,
    options: { composition: 'normal' | 'erase' },
  ) {
    dest.drawImage(input.canvas, 0, 0)
  }

  public async fullyRender(
    dest: CanvasRenderingContext2D,
    doc: RuntimeDocument,
    renderer: Renderer,
    {
      abort,
      viewport,
      override,
      phase,
      logger,
    }: {
      abort?: AbortSignal
      viewport: Viewport
      override?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
      phase: RenderPhase
      logger: RenderCycleLogger
    },
  ): Promise<void> {
    const tmp = createCanvas()
    const tmpctx = tmp.getContext('2d')!
    setCanvasSize(tmp, viewport)

    logger.group('MixerPipeline.fullyRender')

    logger.log('Destination canvas', dest.canvas)
    dest.clearRect(0, 0, dest.canvas.width, dest.canvas.height)
    logger.log('Clear dest canvas')

    logger.time('Render all layers time')
    try {
      for (const node of doc.rootNodes.children) {
        const layer = doc.resolveLayer(node.layerUid)

        if (!layer) {
          logger.error('Bad layer link', node.layerUid)
          continue
        }

        logger.log(
          'Render layer',
          layer.source.uid,
          layer.source.name,
          layer.source.layerType,
        )

        logger.time(`Render layer time: ${layer.source.uid}`)

        let image: ImageBitmap | HTMLCanvasElement | null | void

        if (override?.[layer.source.uid]) {
          image = override[layer.source.uid]
        } else if (layer.source.layerType === 'raster') {
          image = (await doc.getOrCreateLayerBitmapCache(layer.source.uid))!
        } else if (layer.source.layerType === 'vector') {
          const requestSize = { width: viewport.width, height: viewport.height }

          if (doc.hasLayerBitmapCache(layer.source.uid, requestSize)) {
            logger.info('Use cached bitmap for vector layer', layer.source.uid)
            image = (await doc.getOrCreateLayerBitmapCache(
              layer.source.uid,
              requestSize,
            ))!
          } else {
            logger.info(
              'Cache is invalidated, re-render vector layer',
              layer.source.uid,
            )

            await renderer.renderVectorLayer(tmp, layer.source, {
              viewport,
              abort,
              phase,
              logger,
            })

            if (abort?.aborted) throw new PaplicoAbortError()

            image = await doc.updateOrCreateLayerBitmapCache(
              layer.source.uid,
              tmpctx.getImageData(0, 0, viewport.width, viewport.height),
            )
          }
        } else {
          // TODO
          continue
        }

        logger.timeEnd(`Render layer time: ${layer.source.uid}`)

        const mode = layerCompositeModeToCanvasCompositeMode(
          layer.source.compositeMode,
        )

        await saveAndRestoreCanvas(dest, async () => {
          logger.log(
            `Will draw layer ${layer.source.uid} as ${mode} to destination.`,
            image,
          )
          dest.globalCompositeOperation = mode

          const result = rescue(() => dest.drawImage(image!, 0, 0))
          rescue.isFailure(result) &&
            logger.error('drawImage error', result.error)
        })
      }
    } finally {
      freeingCanvas(tmp)

      logger.timeEnd('Render all layers time')
      logger.groupEnd()
    }
  }

  // public async render() {}

  // public async renderVector() {}
}

const layerCompositeModeToCanvasCompositeMode = (mode: CompositeMode) =>
  (
    ({
      normal: 'source-over',
      clipper: 'destination-in',
      multiply: 'multiply',
      overlay: 'overlay',
      screen: 'screen',
    }) as { [k in CompositeMode]: GlobalCompositeOperation }
  )[mode]

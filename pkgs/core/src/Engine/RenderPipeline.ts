import { CompositeMode } from '@/Document'
import {
  clearCanvas,
  freeingCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { rescue } from '@/utils/resque'
import { createContext2D } from './CanvasFactory'
import { RenderCycleLogger } from './RenderCycleLogger'
import { VectorRenderer } from './VectorRenderer'
import { RuntimeDocument } from './RuntimeDocument'
import { RenderPhase, Viewport } from './types'
import { PaplicoAbortError } from '@/Errors'
import { WebGLRenderer } from 'three'
import { AtomicResource, chainedAtomicResource } from '@/utils/AtomicResource'
import { AppearanceRegistry } from '@/Engine/Registry/AppearanceRegistry'
import { FilterWebGLContext } from './Filter/FilterContextAbst'
import { ThreeFilterContext } from './Filter/ThreeFilterContext'
import { deepClone } from '@/utils/object'

export class RenderPipeline {
  protected filterRegistry: AppearanceRegistry
  protected papGLContext: AtomicResource<FilterWebGLContext>

  constructor(options: {
    filterRegistry: AppearanceRegistry
    glRenderer: AtomicResource<WebGLRenderer>
  }) {
    this.filterRegistry = options.filterRegistry

    const glcx = options.glRenderer.ensureForce()
    try {
      this.papGLContext = chainedAtomicResource(
        options.glRenderer,
        new ThreeFilterContext(glcx) as FilterWebGLContext,
      )
    } finally {
      options.glRenderer.release(glcx)
    }
  }

  public dispose() {
    this.papGLContext.clearQueue()
    this.papGLContext.ensureForce().dispose()
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
    renderer: VectorRenderer,
    {
      abort,
      viewport,
      override,
      pixelRatio,
      phase,
      logger,
    }: {
      abort?: AbortSignal
      viewport: Viewport
      override?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
      pixelRatio: number
      phase: RenderPhase
      logger: RenderCycleLogger
    },
  ): Promise<void> {
    const dblBufCx = createContext2D()
    const tmpcx = createContext2D({ willReadFrequently: true })
    setCanvasSize(dblBufCx.canvas, viewport)
    setCanvasSize(tmpcx.canvas, viewport)

    // const filterDstCx = createContext2D()

    logger.group('MixerPipeline.fullyRender')

    // logger.log('Destination canvas', dest.canvas)
    // clearCanvas(dest)
    // logger.log('Clear dest canvas')

    logger.time('Render all layers time')
    try {
      for (const node of doc.rootNodes.children) {
        // Use tmpVectorOutCx for vector layer rendering
        const tmpVectorOutCx = tmpcx

        const layer = doc.resolveLayer(node.layerUid)
        const sourceLayer = layer?.source.deref()

        if (!layer || !sourceLayer) {
          logger.error('Bad layer link', node.layerUid)
          continue
        }

        setCanvasSize(tmpVectorOutCx.canvas, viewport)

        logger.log(
          'Render layer',
          sourceLayer.uid,
          sourceLayer.name,
          sourceLayer.layerType,
        )

        logger.time(`Render layer time: ${sourceLayer.uid}`)

        let layerBitmap: ImageBitmap | HTMLCanvasElement | null | void

        if (override?.[sourceLayer.uid]) {
          layerBitmap = override[sourceLayer.uid]
        } else if (sourceLayer.layerType === 'raster') {
          layerBitmap = (await doc.getOrCreateLayerBitmapCache(
            sourceLayer.uid,
          ))!
        } else if (sourceLayer.layerType === 'vector') {
          const requestSize = { width: viewport.width, height: viewport.height }

          if (doc.hasLayerBitmapCache(sourceLayer.uid, requestSize)) {
            logger.info('Use cached bitmap for vector layer', sourceLayer.uid)
            layerBitmap = (await doc.getOrCreateLayerBitmapCache(
              sourceLayer.uid,
              requestSize,
            ))!
          } else {
            logger.info(
              'Cache is invalidated, re-render vector layer',
              sourceLayer.uid,
            )

            await renderer.renderVectorLayer(
              tmpVectorOutCx.canvas,
              sourceLayer,
              {
                viewport,
                pixelRatio,
                abort,
                phase,
                logger,
              },
            )

            if (abort?.aborted) throw new PaplicoAbortError()

            layerBitmap = await doc.updateOrCreateLayerBitmapCache(
              sourceLayer.uid,
              tmpVectorOutCx.getImageData(
                0,
                0,
                viewport.width,
                viewport.height,
              ),
            )
          }
        } else {
          // TODO
          continue
        }

        if (!layerBitmap) {
          logger.error('Layer bitmap is null', sourceLayer.uid)
          continue
        }

        // Reuse tmpVectorOutCx for filter
        clearCanvas(tmpVectorOutCx)
        setCanvasSize(tmpVectorOutCx.canvas, viewport)
        const filterDstCx = tmpVectorOutCx

        logger.timeEnd(`Render layer time: ${sourceLayer.uid}`)

        // Apply filters
        if (sourceLayer.filters.length > 0) {
          const papglcx = await this.papGLContext.ensure()

          try {
            for (const filter of sourceLayer.filters) {
              if (!filter.enabled) {
                continue
              }

              const instance = this.filterRegistry.getInstance(filter.filterId)

              if (!instance) {
                logger.error(`Filter instance not found`, filter.filterId)
                return
              }

              logger.group(`Apply filter ${instance.id}`)
              logger.time(`Apply filter time: ${instance.id}`)

              await saveAndRestoreCanvas(filterDstCx, async () => {
                clearCanvas(filterDstCx)
                setCanvasSize(filterDstCx.canvas, viewport)

                console.log('apply filter', instance.id)
                await instance.applyRasterFilter?.(layerBitmap!, filterDstCx, {
                  abort: abort ?? new AbortController().signal,
                  abortIfNeeded: () => {
                    if (abort?.aborted) throw new PaplicoAbortError()
                  },

                  gl: papglcx,
                  destSize: { width: viewport.width, height: viewport.height },
                  pixelRatio,

                  filterSetting: deepClone(filter.settings),
                  phase,
                  logger,
                })
              })

              logger.timeEnd(`Apply filter time: ${instance.id}`)

              if (layerBitmap instanceof ImageBitmap) layerBitmap.close()
              layerBitmap = await createImageBitmap(filterDstCx.canvas)
            }
          } finally {
            this.papGLContext.release(papglcx)
          }
        }

        const mode = layerCompositeModeToCanvasCompositeMode(
          sourceLayer.compositeMode,
        )

        logger.log(
          `Will draw layer ${sourceLayer.uid} as ${mode} to destination.`,
          layerBitmap,
        )

        dest.globalCompositeOperation = mode

        const result = rescue(() => {
          dblBufCx.drawImage(layerBitmap!, 0, 0)
        })

        rescue.isFailure(result) &&
          logger.error('drawImage error', result.error)
      }

      clearCanvas(dest)
      dest.drawImage(dblBufCx.canvas!, 0, 0)
    } finally {
      freeingCanvas(tmpcx.canvas)

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

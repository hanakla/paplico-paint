import {
  BlendMode,
  LayerFilter,
  PaplicoDocument,
  VisuElement,
  VisuFilter,
} from '@/Document'
import {
  clearCanvas,
  freeingCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { RenderCycleLogger } from './RenderCycleLogger'
import { VisuOverrides, VectorRenderer } from './VectorRenderer'
import { DocumentContext } from './DocumentContext/DocumentContext'
import { RenderPhase, Viewport } from './types'
import { PPLCAbortError, PPLCInvariantViolationError } from '@/Errors'
import { WebGLRenderer } from 'three'
import { AtomicResource, chainedAtomicResource } from '@/utils/AtomicResource'
import { AppearanceRegistry } from '@/Engine/Registry/AppearanceRegistry'
import { FilterWebGLContext } from './Filter/FilterContextAbst'
import { ThreeFilterContext } from './Filter/ThreeFilterContext'
import { deepClone } from '@/utils/object'
import {
  createBBox,
  createEmptyBBox,
  type LayerMetrics,
} from './DocumentContext/LayerMetrics'
import {
  CanvasToken,
  RenderCommands,
  RenderSource,
  RenderTargets,
  buildRenderSchedule,
} from './Scheduler'
import { unreachable } from '@/utils/unreachable'
import { PaplicoError } from '@/Errors/PaplicoError'
import { Canvas2DAllocator } from '@/Engine/Canvas2DAllocator'
import { logImage } from '@/utils/DebugHelper'
import { LogChannel } from '@/ChannelLog'

export namespace RenderPipeline {
  export type RenderOptions = {
    abort?: AbortSignal
    viewport: Viewport
    override?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
    vectorObjectOverrides?: VisuOverrides
    pixelRatio: number
    phase: RenderPhase
    logger: RenderCycleLogger

    updateCache?: true
  }

  export type RenderResult = {
    /** Newer calcurated bboxes, not all */
    layerBBoxes: Record<string, LayerMetrics.BBoxSet>
    /** Newer calcurated bboxes, not all */
    objectBBoxes: Record<string, LayerMetrics.BBoxSet>
    stats: any
  }
}

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

  public async fullyRenderWithScheduler(
    output: CanvasRenderingContext2D,
    docx: DocumentContext,
    renderer: VectorRenderer,
    options: RenderPipeline.RenderOptions,
  ): Promise<RenderPipeline.RenderResult | undefined> {
    const root = docx.document.getResolvedLayerTree([])

    return this.renderNode(output, docx, root, renderer, {
      ...options,
      updateCache: true,
    })
  }

  public async renderNode(
    output: CanvasRenderingContext2D,
    docCx: DocumentContext,
    startNode: PaplicoDocument.ResolvedLayerNode,
    renderer: VectorRenderer,
    {
      abort,
      viewport,
      override,
      vectorObjectOverrides,
      pixelRatio,
      phase,
      logger,
      updateCache,
    }: RenderPipeline.RenderOptions,
  ): Promise<RenderPipeline.RenderResult | undefined> {
    LogChannel.l.pipeline('Start renderNode', startNode)

    const { tasks: schedules } = buildRenderSchedule(startNode, docCx, {
      layerNodeOverides: override,
    })

    LogChannel.l.pipelineSchedule('scheduled', schedules)

    const canvasByToken = new WeakMap<CanvasToken, CanvasRenderingContext2D>()
    const canvasByRole: {
      [role: string]: CanvasRenderingContext2D | undefined
    } = {}
    let borrowedCanvases = new Set()

    const tmpVectorOutCx = Canvas2DAllocator.borrow({
      width: viewport.width,
      height: viewport.height,
      willReadFrequently: true,
    })
    borrowedCanvases.add(tmpVectorOutCx)

    let usedCanvasCount = 1
    let dynamicCanvasCount = 0
    let clearCount = 0
    let draws = 0

    const layerMetrics: Record<string, LayerMetrics.BBoxSet> = {}
    const objectMetrics: Record<string, LayerMetrics.BBoxSet> = {}

    try {
      const predest = Canvas2DAllocator.borrow({
        width: viewport.width,
        height: viewport.height,
      })

      canvasByToken.set(RenderTargets.PREDEST, predest)
      borrowedCanvases.add(predest)

      for (const task of schedules) {
        const { command } = task

        switch (command) {
          case RenderCommands.DRAW_SOURCE_TO_DEST: {
            const {
              source,
              renderTarget,
              blendMode,
              opacity,
              clearTarget,
              parentTransformForText,
            } = task
            if (renderTarget === RenderTargets.NONE) break

            const sourceImage = await getSource(source, parentTransformForText)
            const targetCanvas = getRenderTarget(renderTarget, {
              width: viewport.width,
              height: viewport.height,
            })

            if (!sourceImage) {
              throw new PaplicoError(`Invalid source: ${source}`)
            }

            if (!targetCanvas) break

            draws++

            saveAndRestoreCanvas(targetCanvas, (cx) => {
              cx.globalCompositeOperation =
                layerBlendModeToCanvasCompositeOperation(blendMode)

              cx.globalAlpha = opacity
              setCanvasSize(cx.canvas, sourceImage.width, sourceImage.height)

              if (clearTarget) clearCanvas(cx)

              cx.drawImage(sourceImage.image, 0, 0)
            })

            break
          }

          case RenderCommands.PRERENDER_SOURCE: {
            const { source } = task
            await getSource(source)
            break
          }

          case RenderCommands.APPLY_LAYER_FILTER: {
            const { source, renderTarget, filter, clearTarget } = task

            const sourceImage = await getSource(source)
            const targetCanvas = getRenderTarget(renderTarget, {
              width: viewport.width,
              height: viewport.height,
            })

            if (!sourceImage) {
              throw new PaplicoError(`Invalid source: ${source}`)
            }

            if (!targetCanvas) {
              throw new PaplicoError(`Invalid render target: ${renderTarget}`)
            }

            if (clearTarget) clearCanvas(targetCanvas)

            await this.applyFilter(sourceImage.image, targetCanvas, filter, {
              abort,
              phase,
              pixelRatio,
              viewport,
              logger,
            })

            break
          }

          case RenderCommands.APPLY_INTERNAL_OBJECT_FILTER: {
            const { renderTarget, layerUid, filter, clearTarget } = task
            let { object } = task

            const targetCanvas = getRenderTarget(renderTarget, {
              width: viewport.width,
              height: viewport.height,
            })

            if (!targetCanvas) {
              throw new PaplicoError(`Invalid render target: ${renderTarget}`)
            }

            if (clearTarget) clearCanvas(targetCanvas)

            // Process overrides
            object =
              vectorObjectOverrides?.[layerUid]?.(deepClone(object)) ?? object

            if (filter.kind === 'fill') {
              await renderer.renderFill(
                targetCanvas,
                object.path,
                filter.fill,
                {
                  transform: object.transform,
                  phase,
                  pixelRatio,
                  abort,
                  logger,
                },
              )
            } else if (filter.kind === 'stroke') {
              await renderer.renderStroke(
                targetCanvas.canvas,
                object.path,
                filter.stroke,
                {
                  transform: object.transform,
                  inkSetting: filter.ink,
                  phase,
                  pixelRatio,
                  abort,
                  logger,
                },
              )
            } else {
              unreachable(filter)
            }

            break
          }

          case RenderCommands.APPLY_EXTERNAL_OBJECT_FILTER: {
            const { source, renderTarget, filter } = task

            const sourceImage = await getSource(source)
            const targetCanvas = getRenderTarget(renderTarget, {
              width: viewport.width,
              height: viewport.height,
            })

            if (!sourceImage) {
              throw new PPLCInvariantViolationError(
                `Invalid source: ${renderTarget}`,
              )
            }

            if (!targetCanvas) {
              throw new PPLCInvariantViolationError(
                `Invalid render target: ${renderTarget}`,
              )
            }

            await this.applyFilter(
              sourceImage.image,
              targetCanvas,
              filter.processor,
              {
                abort,
                phase,
                pixelRatio,
                viewport,
                logger,
              },
            )

            break
          }

          case RenderCommands.CLEAR_TARGET: {
            const { renderTarget } = task
            const target = getRenderTarget(renderTarget, null)
            if (!target)
              throw new PPLCInvariantViolationError(
                `Invalid clear target: ${renderTarget}`,
              )

            clearCanvas(target)
            clearCount++
            break
          }

          case RenderCommands.FREE_TARGET: {
            const { renderTarget } = task
            if (renderTarget == null) {
              throw new PPLCInvariantViolationError(
                `Invalid render target: ${renderTarget}`,
              )
            }

            const cx = canvasByToken.get(renderTarget)
            if (cx) {
              freeingCanvas(cx.canvas)
              canvasByToken.delete(renderTarget)
              Canvas2DAllocator.return(cx)
            }

            break
          }
        }
      }

      clearCanvas(output)
      clearCount++
      output.drawImage(predest.canvas, 0, 0)

      const stats = {
        usedCanvasCount,
        dynamicCanvasCount,
        clearCount,
        draws,
      }

      LogChannel.l.pipeline('End renderNode', stats)

      return {
        layerBBoxes: layerMetrics,
        objectBBoxes: objectMetrics,
        stats,
      }
    } finally {
      borrowedCanvases.forEach((cx) => Canvas2DAllocator.return(cx))
    }

    // getter functions

    function getRenderTarget(
      target: RenderTargets,
      size: { width: number; height: number } | null,
    ) {
      if (!target) return null
      if (!('__canvasToken' in target)) return null

      if (!size && !canvasByToken.has(target)) {
        throw new PaplicoError(
          'fullyRenderWithScheduler: inviolate state. trying uninitialized canvas without size',
        )
      }

      let cx = canvasByToken.get(target)

      if (!cx) {
        usedCanvasCount++
        dynamicCanvasCount++

        cx = Canvas2DAllocator.borrow(size!)
        borrowedCanvases.add(cx)
        canvasByToken.set(target, cx)
      }

      return cx
    }

    async function getSource(
      source: RenderSource,
      parentTransform?: VisuElement.ElementTransform,
    ): Promise<null | {
      image: HTMLCanvasElement | ImageBitmap
      width: number
      height: number
    }> {
      let layerBitmap: HTMLCanvasElement | ImageBitmap | null = null

      if (source == null) return null
      else if ('__canvasToken' in source) {
        const cx = getRenderTarget(source, null)!

        return {
          image: cx.canvas,
          width: cx.canvas.width,
          height: cx.canvas.height,
        }
      } else if ('bitmap' in source) {
        return {
          image: source.bitmap,
          width: source.bitmap.width,
          height: source.bitmap.height,
        }
      } else if ('visuNode' in source) {
        const { visuNode } = source

        // proceed by scheduler
        // if (override?.[sourceVisu.uid]) {
        //   layerBitmap = override[sourceVisu.uid]
        // }

        if (visuNode.visu.type === 'canvas') {
          LogChannel.l.pipeline(
            `getSource: Request to Render ${visuNode.visu.type} `,
            visuNode,
          )

          layerBitmap = (await docCx.getOrCreateLayerNodeBitmapCache(
            visuNode.uid,
          ))!

          layerMetrics[visuNode.uid] ??= {
            source: createBBox({
              left: visuNode.visu.transform.position.x,
              top: visuNode.visu.transform.position.y,
              width: layerBitmap.width,
              height: layerBitmap.height,
            }),
            visually: createEmptyBBox(),
          }
        } else if (
          visuNode.visu.type === 'vectorObject' ||
          visuNode.visu.type === 'text'
        ) {
          LogChannel.l.pipeline(
            `getSource: Request to Render ${visuNode.visu.type} `,
            visuNode,
          )

          const requestSize = { width: viewport.width, height: viewport.height }

          const hasOverrideForThisLayer =
            !!vectorObjectOverrides?.[visuNode.uid]

          const canUseBitmapCache =
            docCx.hasLayerNodeBitmapCache(visuNode.uid, requestSize) &&
            vectorObjectOverrides?.[visuNode.uid] == null

          if (canUseBitmapCache) {
            LogChannel.l.pipeline.info(`Use bitmap cache for ${visuNode.uid}`)
            logger.info('Use cached bitmap for vector layer', visuNode.uid)

            layerBitmap = (await docCx.getOrCreateLayerNodeBitmapCache(
              visuNode.uid,
              requestSize,
            ))!
          } else {
            LogChannel.l.pipeline.info(
              'Cache is invalidated, re-render vector layer',
              visuNode.uid,
            )

            const { layerBBox, objectsBBox } = await renderer.renderVectorVisu(
              tmpVectorOutCx,
              visuNode.visu,
              {
                viewport,
                pixelRatio,
                objectOverrides: vectorObjectOverrides,
                abort,
                phase,
                logger,
                parentTransform,
              },
            )

            layerMetrics[visuNode.uid] = layerBBox
            for (const [uid, bbox] of Object.entries(objectsBBox)) {
              objectMetrics[uid] = bbox
            }

            if (abort?.aborted) throw new PPLCAbortError()

            if (hasOverrideForThisLayer) {
              // For perfomance, avoid getImageData when using override
              const overrided = Canvas2DAllocator.borrow({
                width: viewport.width,
                height: viewport.height,
              })
              clearCount++
              overrided.drawImage(tmpVectorOutCx.canvas, 0, 0)
              Canvas2DAllocator.return(overrided)

              layerBitmap = overrided.canvas
            } else {
              if (updateCache) {
                LogChannel.l.pipeline.info(
                  `Update bitmap cache for ${visuNode.uid}`,
                )

                layerBitmap = tmpVectorOutCx.canvas

                await docCx.updateOrCreateLayerBitmapCache(
                  visuNode.uid,
                  tmpVectorOutCx.getImageData(
                    0,
                    0,
                    viewport.width,
                    viewport.height,
                  ),
                )
              } else {
                layerBitmap = tmpVectorOutCx.canvas
              }
            }
          }
        } else {
          throw new PPLCInvariantViolationError(
            `Unexpected source in getSource(): ${source.visuNode.visu.type}`,
          )
        }
      }

      if (!layerBitmap) {
        LogChannel.l.pipeline.error('Failed to fetch layer bitmap', source)
        throw new PPLCInvariantViolationError(
          `Failed to fetch layer bitmap: ${JSON.stringify(source).slice(
            0,
            100,
          )}`,
          { source, layerBitmap },
        )
      }

      return {
        image: layerBitmap,
        width: layerBitmap.width,
        height: layerBitmap.height,
      }
    }
  }

  public async applyFilter(
    input: TexImageSource,
    outcx: CanvasRenderingContext2D,
    filter: Omit<VisuFilter.ExternalFilter<any>['processor'], 'enabled'>,
    {
      abort,
      viewport,
      pixelRatio,
      phase,
      logger,
    }: {
      abort?: AbortSignal
      viewport: Viewport
      pixelRatio: number
      phase: RenderPhase
      logger?: RenderCycleLogger
    },
  ) {
    const papglcx = await this.papGLContext.ensure()

    try {
      const instance = this.filterRegistry.getInstance(filter.filterId)

      if (!instance) {
        logger?.error(`Filter instance not found`, filter.filterId)
        return
      }

      logger?.group(`Apply filter ${instance.id}`)
      logger?.time(`Apply filter time: ${instance.id}`)

      await saveAndRestoreCanvas(outcx, async () => {
        setCanvasSize(outcx.canvas, viewport)

        // FIXME: Return bboxes
        await instance.applyRasterFilter?.(input, outcx, {
          abort: abort ?? new AbortController().signal,
          throwIfAborted: () => {
            if (abort?.aborted) throw new PPLCAbortError()
          },

          gl: papglcx,
          destSize: { width: viewport.width, height: viewport.height },
          pixelRatio,

          filterSetting: deepClone(filter.settings),
          phase,
          logger: logger ?? new RenderCycleLogger(),
        })
      })

      logger?.timeEnd(`Apply filter time: ${instance.id}`)
    } finally {
      this.papGLContext.release(papglcx)
    }
  }
}

const layerBlendModeToCanvasCompositeOperation = (mode: BlendMode) =>
  (
    ({
      normal: 'source-over',
      clipper: 'destination-in',
      multiply: 'multiply',
      overlay: 'overlay',
      screen: 'screen',
    }) as { [k in BlendMode]: GlobalCompositeOperation }
  )[mode]

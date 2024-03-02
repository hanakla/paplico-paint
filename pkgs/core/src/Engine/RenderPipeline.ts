import { PaplicoDocument, VisuElement, VisuFilter } from '@/Document'
import {
  clearCanvas,
  freeingCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { RenderCycleLogger } from './RenderCycleLogger'
import { VectorRenderer } from './VectorRenderer'
import { DocumentContext } from './DocumentContext/DocumentContext'
import { RenderPhase, Viewport } from './types'
import { PPLCAbortError, PPLCInvariantViolationError } from '@/Errors'
// import { WebGLRenderer } from 'three'
import { AtomicResource } from '@/utils/AtomicResource'
import { AppearanceRegistry } from '@/Engine/Registry/AppearanceRegistry'
import { IFilterWebGLContext } from './Filter/FilterContextAbst'
// import { ThreeFilterContext } from './Filter/ThreeFilterContext'
import { deepClone } from '@paplico/shared-lib'
import { type LayerMetrics } from './DocumentContext/LayerMetrics'
import {
  CanvasToken,
  RenderCommands,
  RenderSource,
  RenderTargets,
} from './Scheduler.Const'
import { buildRenderSchedule } from './Scheduler'
import { PaplicoError } from '@/Errors/PaplicoError'
import { Canvas2DAllocator } from '@/Infra/Canvas2DAllocator'
import { LogChannel } from '@/Debugging/LogChannel'
import {
  composeVisuTransforms,
  multiplyMatrix,
  visuTransformToMatrix2D,
} from './VectorUtils'
import { formatStack } from '@/utils/debug-utils'
import { unreachable } from '@paplico/shared-lib'
import { WebGLFilterContext } from './Filter/WebGLFilterContext'

export namespace RenderPipeline {
  /**
   * Override rendering result of visu, it only specify to Group or Canvas node only
   * Otherwise, it will be ignored
   */
  export type LayerNodeOverrides = {
    [visuUid: string]: HTMLCanvasElement | ImageBitmap
  }

  export type RenderOptions = {
    abort?: AbortSignal
    viewport: Viewport
    layerNodeOverrides?: LayerNodeOverrides
    transformOverrides?: VectorRenderer.VisuTransformOverrides
    offsetTransform?: VisuElement.ElementTransform
    pixelRatio: number
    phase: RenderPhase
    logger: RenderCycleLogger

    /** Update bitmap cache in render time, only rendered node not target of any overrides */
    updateCacheIfAble?: boolean
  }

  export type RenderResult = {
    /** Newer calcurated bboxes (not all visues included) */
    visuMetrics: Record<string, LayerMetrics.BBoxSet>
    stats: any
  }

  export type CompositionImageSource =
    | ImageBitmap
    | HTMLImageElement
    | HTMLCanvasElement
    | OffscreenCanvas
}

export class RenderPipeline {
  protected filterRegistry: AppearanceRegistry
  protected papGLContext: AtomicResource<WebGLFilterContext>

  protected precompBitmapCache: Record<string, ImageBitmap> = {}

  constructor(options: {
    filterRegistry: AppearanceRegistry
    filterRenderer: AtomicResource<WebGLFilterContext>
  }) {
    this.filterRegistry = options.filterRegistry
    this.papGLContext = options.filterRenderer
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
    const root = docx.document.layerNodes.getResolvedLayerNodes([])

    return this.renderNode(output, docx, root, renderer, {
      ...options,
      updateCacheIfAble: true,
    })
  }

  public async renderNode(
    output: CanvasRenderingContext2D,
    docx: DocumentContext,
    startNode: PaplicoDocument.ResolvedLayerNode,
    renderer: VectorRenderer,
    {
      abort,
      viewport,
      layerNodeOverrides,
      transformOverrides,
      pixelRatio,
      phase,
      logger,
      updateCacheIfAble,
      offsetTransform,
    }: RenderPipeline.RenderOptions,
  ): Promise<RenderPipeline.RenderResult | undefined> {
    LogChannel.l.pipeline(
      '⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬⏬\nStart renderNode',
      {
        startNode,
        transformOverrides,
        layerNodeOverrides,
      },
    )
    LogChannel.l.pipeline('  Requested by:\n' + formatStack(new Error(), 2))

    const { tasks: schedules } = buildRenderSchedule(startNode, docx, {
      layerNodeOverrides,
      willRenderingViewport: viewport,
      offsetTransform,
      // prevCacheBreakerNodes: this.previousCacheBreakerNodes,
    })

    LogChannel.l.pipeline('scheduled', schedules)

    const canvasByToken = new Map<CanvasToken, CanvasRenderingContext2D>()
    let borrowedCanvases = new Set<CanvasRenderingContext2D>()

    const usedPrecompKeys = new Set<string>()
    const precompBitmapCache = this.precompBitmapCache

    const tmpVectorOutCx = Canvas2DAllocator.borrow({
      width: viewport.width,
      height: viewport.height,
      willReadFrequently: true,
    })
    borrowedCanvases.add(tmpVectorOutCx)

    // const cacheBreakerNodes: Record<string, boolean> = {}
    let usedCanvasCount = 1
    let dynamicCanvasCount = 0
    let clearCount = 0
    let draws = 0

    const visuMetrics: Record<string, LayerMetrics.BBoxSet> = {}

    try {
      const predest = Canvas2DAllocator.borrow({
        width: viewport.width,
        height: viewport.height,
      })

      canvasByToken.set(RenderTargets.PREDEST, predest)
      borrowedCanvases.add(predest)

      for (let taskIdx = 0, l = schedules.length; taskIdx < l; taskIdx++) {
        const task = schedules[taskIdx]

        LogChannel.l.pipeline('>> Render task', task)

        switch (task.command) {
          case RenderCommands.DRAW_OVERRIDED_SOURCE_TO_DEST: {
            const sourceImage = (await getSource(task.source))!
            const targetCanvas = getRenderTarget(task.renderTarget, {
              width: viewport.width,
              height: viewport.height,
            })!

            draws++

            saveAndRestoreCanvas(targetCanvas, (cx) => {
              cx.globalCompositeOperation =
                layerBlendModeToCanvasCompositeOperation(task.blendMode)
              cx.globalAlpha = task.opacity

              cx.setTransform(
                multiplyMatrix(
                  visuTransformToMatrix2D(task.parentTransform),
                  visuTransformToMatrix2D(task.sourceVisu.transform),
                ),
              )

              cx.drawImage(sourceImage.image, 0, 0)
            })

            break
          }
          case RenderCommands.DRAW_SOURCE_TO_DEST: {
            if (task.renderTarget === RenderTargets.NONE) break

            const sourceImage = await getSource(task.source)
            const targetCanvas = getRenderTarget(task.renderTarget, {
              width: viewport.width,
              height: viewport.height,
            })

            if (!sourceImage) {
              throw new PaplicoError(`Invalid source: ${task.source}`)
            }

            if (!targetCanvas) break

            draws++

            saveAndRestoreCanvas(targetCanvas, (cx) => {
              cx.globalCompositeOperation =
                layerBlendModeToCanvasCompositeOperation(task.blendMode)
              cx.globalAlpha = task.opacity
              cx.drawImage(sourceImage.image, 0, 0)
            })

            break
          }
          case RenderCommands.DRAW_VISU_TO_DEST: {
            if (task.renderTarget === RenderTargets.NONE) break

            const sourceImage = await getSource(
              task.source,
              task.parentTransform,
            )
            const targetCanvas = getRenderTarget(task.renderTarget, {
              width: viewport.width,
              height: viewport.height,
            })

            if (!sourceImage) {
              throw new PaplicoError(`Invalid source: ${task.source}`)
            }

            if (!sourceImage.transformResolved) {
              LogChannel.l.pipeline.error('Transform unresolved source', task)
              throw new PPLCInvariantViolationError(
                `Transform unresolved source: ${task.source}`,
              )
            }

            if (!targetCanvas) break

            draws++

            saveAndRestoreCanvas(targetCanvas, (cx) => {
              cx.globalCompositeOperation =
                layerBlendModeToCanvasCompositeOperation(task.blendMode)
              cx.globalAlpha = task.opacity
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
            const { source, renderTarget, filter } = task

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
            const { renderTarget, objectVisu, filter, parentTransform } = task
            let { objectVisu: object } = task

            const targetCanvas = getRenderTarget(renderTarget, {
              width: viewport.width,
              height: viewport.height,
            })

            if (!targetCanvas) {
              throw new PaplicoError(`Invalid render target: ${renderTarget}`)
            }

            const hasTransformOverride = !!transformOverrides?.[objectVisu.uid]

            // Process overrides
            object =
              transformOverrides?.[objectVisu.uid]?.(deepClone(object)) ??
              object

            if (object.type !== 'vectorObject') continue

            if (filter.kind === 'fill') {
              const fillResult = await renderer.renderFill(
                object.path,
                targetCanvas,
                filter.fill,
                {
                  transform: composeVisuTransforms(
                    parentTransform,
                    object.transform,
                  ),
                  phase,
                  pixelRatio,
                  abort,
                  logger,
                },
              )

              if (!hasTransformOverride) {
                visuMetrics[objectVisu.uid] = fillResult.metrics
              }
            } else if (filter.kind === 'stroke') {
              const result = await renderer.renderStroke(
                object.path,
                targetCanvas,
                filter.stroke,
                {
                  transform: composeVisuTransforms(
                    parentTransform,
                    object.transform,
                  ),
                  inkSetting: filter.ink,
                  phase,
                  pixelRatio,
                  abort,
                  logger,
                },
              )

              if (!hasTransformOverride) {
                visuMetrics[objectVisu.uid] = result.metrics
              }
            } else {
              unreachable(filter)
            }

            break
          }

          case RenderCommands.APPLY_POSTPROCESS_FILTER: {
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
            const { renderTarget, setSize } = task
            const target = getRenderTarget(
              renderTarget,
              setSize === 'VIEWPORT' ? viewport : null,
            )
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
        visuMetrics,
        stats,
      }
    } finally {
      borrowedCanvases.forEach((cx) => Canvas2DAllocator.return(cx))
    }

    ///////////////////////////////
    // getter functions
    ///////////////////////////////

    function getRenderTarget(
      target: RenderTargets,
      size: { width: number; height: number } | null,
    ) {
      if (!target) return null
      if (!('__canvasToken' in target)) return null

      if (!size && !canvasByToken.has(target)) {
        LogChannel.l.pipeline.error(target, size)
        throw new PaplicoError(
          'renderNode.getRenderTarget: inviolate state. trying uninitialized canvas without size',
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
      transformResolved: boolean
      image: HTMLCanvasElement | ImageBitmap
      width: number
      height: number
    }> {
      let transformResolved = false
      let layerBitmap: HTMLCanvasElement | ImageBitmap | null = null

      if (source == null) return null
      else if ('__canvasToken' in source) {
        const cx = getRenderTarget(source, null)!

        return {
          transformResolved,
          image: cx.canvas,
          width: cx.canvas.width,
          height: cx.canvas.height,
        }
      } else if ('bitmap' in source) {
        return {
          transformResolved: false,
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

          const bbox = await renderer.renderCanvasVisu(
            visuNode.visu,
            tmpVectorOutCx,
            docx,
            {
              phase,
              pixelRatio,
              viewport,
              logger,
              parentTransform,
              transformOverrides,
              abort,
            },
          )

          transformResolved = true
          layerBitmap = tmpVectorOutCx.canvas

          visuMetrics[visuNode.uid] = bbox
        } else if (
          visuNode.visu.type === 'vectorObject' ||
          visuNode.visu.type === 'text'
        ) {
          LogChannel.l.pipeline(
            `getSource: Request to Render ${visuNode.visu.type} `,
            visuNode,
          )

          const requestSize = { width: viewport.width, height: viewport.height }

          const hasOverrideForThisVectorVisu =
            !!transformOverrides?.[visuNode.uid]

          const canUseBitmapCache =
            docx.hasLayerNodeBitmapCache(visuNode.uid, requestSize) &&
            !hasOverrideForThisVectorVisu

          if (canUseBitmapCache) {
            LogChannel.l.pipeline.info(`Use bitmap cache for ${visuNode.uid}`)
            logger.info('Use cached bitmap for vector layer', visuNode.uid)

            transformResolved = true
            layerBitmap = (await docx.getOrCreateLayerNodeBitmapCache(
              visuNode.uid,
              requestSize,
            ))!
          } else {
            // cacheBreakerNodes[visuNode.path.join('/')] = true

            LogChannel.l.pipeline.info(
              'Cache is invalidated, re-render vector layer',
              visuNode.uid,
            )

            transformResolved = true
            const metrics = await renderer.renderVectorVisu(
              visuNode.visu,
              tmpVectorOutCx,
              {
                viewport,
                pixelRatio,
                transformOverrides,
                abort,
                phase,
                logger,
                parentTransform,
              },
            )

            layerBitmap = tmpVectorOutCx.canvas

            if (abort?.aborted) throw new PPLCAbortError()

            if (!hasOverrideForThisVectorVisu) {
              visuMetrics[visuNode.uid] = metrics

              if (updateCacheIfAble) {
                LogChannel.l.pipeline.info(
                  `Update bitmap cache for ${visuNode.uid}`,
                )

                await docx.updateOrCreateLayerBitmapCache(
                  visuNode.uid,
                  tmpVectorOutCx.getImageData(
                    0,
                    0,
                    viewport.width,
                    viewport.height,
                  ),
                )
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
        transformResolved,
        image: layerBitmap,
        width: layerBitmap.width,
        height: layerBitmap.height,
      }
    }
  }

  public async applyFilter(
    input: RenderPipeline.CompositionImageSource,
    outcx: CanvasRenderingContext2D,
    filter: Omit<VisuFilter.Structs.PostProcessSetting, 'enabled'>,
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
        // setCanvasSize(outcx.canvas, viewport)

        // FIXME: Return bboxes
        await instance.applyRasterFilter?.(input, outcx, {
          abort: abort ?? new AbortController().signal,
          throwIfAborted: () => {
            if (abort?.aborted) throw new PPLCAbortError()
          },

          gl: papglcx,
          destSize: { width: viewport.width, height: viewport.height },
          pixelRatio,

          settings: deepClone(filter.settings),
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

const layerBlendModeToCanvasCompositeOperation = (
  mode: VisuElement.BlendMode,
) =>
  (
    ({
      normal: 'source-over',
      clipper: 'destination-in',
      multiply: 'multiply',
      overlay: 'overlay',
      screen: 'screen',
    }) as { [k in VisuElement.BlendMode]: GlobalCompositeOperation }
  )[mode]

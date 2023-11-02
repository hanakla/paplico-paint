import {
  CompositeMode,
  LayerEntity,
  LayerFilter,
  VectorObject,
} from '@/Document'
import {
  clearCanvas,
  freeingCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { rescue } from '@/utils/resque'
import {
  createCanvas,
  createContext2D,
  createImageBitmapImpl,
  isCanvasElement,
} from './CanvasFactory'
import { RenderCycleLogger } from './RenderCycleLogger'
import { VectorObjectOverrides, VectorRenderer } from './VectorRenderer'
import { DocumentContext } from './DocumentContext/DocumentContext'
import { RenderPhase, Viewport } from './types'
import { PaplicoAbortError } from '@/Errors'
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
import { logImage } from '@/utils/DebugHelper'

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
    dest: CanvasRenderingContext2D,
    docCx: DocumentContext,
    renderer: VectorRenderer,
    {
      abort,
      viewport,
      override,
      vectorObjectOverrides,
      pixelRatio,
      phase,
      logger,
    }: {
      abort?: AbortSignal
      viewport: Viewport
      override?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
      vectorObjectOverrides?: VectorObjectOverrides
      pixelRatio: number
      phase: RenderPhase
      logger: RenderCycleLogger
    },
  ): Promise<
    | {
        /** Newer calcurated bboxes, not all */
        layerBBoxes: Record<string, LayerMetrics.BBoxSet>
        /** Newer calcurated bboxes, not all */
        objectBBoxes: Record<string, LayerMetrics.BBoxSet>
      }
    | undefined
  > {
    const { tasks: schedules } = buildRenderSchedule(docCx.rootNode, docCx, {
      layerOverrides: override,
    })

    console.log(schedules)

    const canvasStore = new WeakMap<CanvasToken, CanvasRenderingContext2D>()
    const canvases: { [role: string]: CanvasRenderingContext2D | undefined } = {
      [RenderTargets.PREDEST]: createContext2D({ willReadFrequently: true }),
    }
    let usedCanvasCount = 1
    let dynamicCanvasCount = 0

    const predest = canvases[RenderTargets.PREDEST]!
    const tmpVectorOutCx = createContext2D({ willReadFrequently: true })

    const layerMetrics: Record<string, LayerMetrics.BBoxSet> = {}
    const objectMetrics: Record<string, LayerMetrics.BBoxSet> = {}

    for (const task of schedules) {
      const { command } = task

      switch (command) {
        case RenderCommands.DRAW_SOURCE_TO_DEST: {
          const { source, renderTarget, compositeMode, opacity, clearTarget } =
            task
          if (renderTarget === RenderTargets.NONE) break

          const sourceImage = await getSource(source)
          const targetCanvas = getRenderTarget(renderTarget)

          if (!sourceImage || sourceImage === 'NONE') {
            throw new PaplicoError(`Invalid source: ${source}`)
          }

          if (targetCanvas === 'NONE') break
          if (!targetCanvas) {
            throw new PaplicoError(`Invalid render target: ${renderTarget}`)
          }

          saveAndRestoreCanvas(targetCanvas.x, (cx) => {
            cx.globalCompositeOperation =
              layerCompositeModeToCanvasCompositeMode(compositeMode)

            cx.globalAlpha = opacity
            setCanvasSize(cx.canvas, sourceImage.width, sourceImage.height)

            if (clearTarget) clearCanvas(cx)

            cx.drawImage(sourceImage.image, 0, 0)
          })

          break
        }

        case RenderCommands.PRERENDER_SOURCE: {
          const { source } = task
          getSource(source)
          break
        }

        case RenderCommands.APPLY_LAYER_FILTER: {
          const { source, renderTarget, filter, clearTarget } = task

          const sourceImage = await getSource(source)
          const targetCanvas = getRenderTarget(renderTarget)

          if (!sourceImage || sourceImage === 'NONE') {
            throw new PaplicoError(`Invalid source: ${source}`)
          }

          if (!targetCanvas || targetCanvas === 'NONE') {
            throw new PaplicoError(`Invalid render target: ${renderTarget}`)
          }

          if (clearTarget) clearCanvas(targetCanvas.x)

          await this.applyFilter(sourceImage.image, targetCanvas.x, filter, {
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

          const targetCanvas = getRenderTarget(renderTarget)

          if (!targetCanvas || targetCanvas === 'NONE') {
            throw new PaplicoError(`Invalid render target: ${renderTarget}`)
          }

          if (clearTarget) clearCanvas(targetCanvas.x)

          // Process overrides
          object =
            vectorObjectOverrides?.[layerUid]?.[object.uid]?.(
              deepClone(object),
            ) ?? object

          if (filter.kind === 'fill') {
            await renderer.renderFill(
              targetCanvas.x,
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
              targetCanvas.x.canvas,
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
          const { source, renderTarget, layerUid, objectUid, filter } = task

          const sourceImage = await getSource(source)
          const targetCanvas = getRenderTarget(renderTarget)

          if (!sourceImage || sourceImage === 'NONE') {
            throw new PaplicoError(`Invalid source: ${source}`)
          }

          if (!targetCanvas || targetCanvas === 'NONE') {
            throw new PaplicoError(`Invalid render target: ${renderTarget}`)
          }

          await this.applyFilter(
            sourceImage.image,
            targetCanvas.x,
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
          const target = getRenderTarget(renderTarget)
          if (!target || target === 'NONE') break
          clearCanvas(target.x)
          break
        }

        case RenderCommands.FREE_TARGET: {
          const { renderTarget } = task
          if (
            typeof renderTarget !== 'string' &&
            '__canvasToken' in renderTarget
          ) {
            const cx = canvasStore.get(renderTarget)
            if (cx) {
              freeingCanvas(cx.canvas)
              canvasStore.delete(renderTarget)
            }
          } else {
            throw new PaplicoError(
              `Non freeable  render target: ${renderTarget}`,
            )
          }

          break
        }
      }
    }

    clearCanvas(dest)
    dest.drawImage(predest.canvas, 0, 0)

    return {
      layerBBoxes: layerMetrics,
      objectBBoxes: objectMetrics,
      stats: {
        usedCanvasCount,
        dynamicCanvasCount,
      },
    }

    // getter functions

    function getRenderTarget(target: RenderTargets) {
      const getOrCreate = (
        role: string,
        options?: CanvasRenderingContext2DSettings,
      ) => {
        if (canvases[role]) return canvases[role]!

        usedCanvasCount++
        canvases[role] = createContext2D(options)
        setCanvasSize(canvases[role]!.canvas, viewport)
        return canvases[role]!
      }

      switch (target) {
        case RenderTargets.PREDEST: {
          const predest = getOrCreate(RenderTargets.PREDEST)

          return {
            x: predest,
            image: predest.canvas,
            width: predest.canvas.width,
            height: predest.canvas.height,
          }
        }
        case RenderTargets.VECTOR_PRE_FILTER: {
          const vectorPreFilter = getOrCreate(RenderTargets.VECTOR_PRE_FILTER)
          return {
            x: vectorPreFilter,
            image: vectorPreFilter.canvas,
            width: vectorPreFilter.canvas.width,
            height: vectorPreFilter.canvas.height,
          }
        }
        case RenderTargets.SHARED_FILTER_BUF: {
          const sharedFilterBuf = getOrCreate(RenderTargets.SHARED_FILTER_BUF)
          return {
            x: sharedFilterBuf,
            image: sharedFilterBuf.canvas,
            width: sharedFilterBuf.canvas.width,
            height: sharedFilterBuf.canvas.height,
          }
        }
        case RenderTargets.NONE: {
          return 'NONE' as const
        }
        case RenderTargets.VECTOR_PRE_FILTER: {
          const vectorPreFilter = getOrCreate(RenderTargets.VECTOR_PRE_FILTER)
          return {
            x: vectorPreFilter,
            image: vectorPreFilter.canvas,
            width: vectorPreFilter.canvas.width,
            height: vectorPreFilter.canvas.height,
          }
        }
        case RenderTargets.PRE_FILTER: {
          const preFilterCx = getOrCreate(RenderTargets.PRE_FILTER)
          return {
            x: preFilterCx,
            image: preFilterCx.canvas,
            width: preFilterCx.canvas.width,
            height: preFilterCx.canvas.height,
          }
        }
        case RenderTargets.GL_RENDER_TARGET1: {
          return null
        }
        default: {
          if (!('__canvasToken' in target)) return unreachable(target)

          const token = target
          let cx = canvasStore.get(token)

          if (!cx) {
            usedCanvasCount++
            dynamicCanvasCount++
            cx = createContext2D()
          }

          canvasStore.set(token, createContext2D())

          return {
            x: cx,
            image: cx.canvas,
            width: cx.canvas.width,
            height: cx.canvas.height,
          }
        }
      }
    }

    async function getSource(source: RenderSource): Promise<
      | 'NONE'
      | undefined
      | null
      | {
          image: HTMLCanvasElement | ImageBitmap
          width: number
          height: number
        }
    > {
      if (typeof source === 'string' || '__canvasToken' in source) {
        return getRenderTarget(source)
      } else if ('bitmap' in source) {
        return {
          image: source.bitmap,
          width: source.bitmap.width,
          height: source.bitmap.height,
        }
      }

      let layerBitmap: HTMLCanvasElement | ImageBitmap
      const { layer: sourceLayer } = source

      if (override?.[sourceLayer.uid]) {
        layerBitmap = override[sourceLayer.uid]
      } else if (sourceLayer.layerType === 'raster') {
        layerBitmap = (await docCx.getOrCreateLayerBitmapCache(
          sourceLayer.uid,
        ))!

        layerMetrics[sourceLayer.uid] ??= {
          source: createBBox({
            left: sourceLayer.transform.position.x,
            top: sourceLayer.transform.position.y,
            width: layerBitmap.width,
            height: layerBitmap.height,
          }),
          visually: createEmptyBBox(),
        }
      } else if (
        // sourceLayer.layerType === 'vector' ||
        sourceLayer.layerType === 'text'
      ) {
        const requestSize = { width: viewport.width, height: viewport.height }

        const hasOverrideForThisLayer =
          !!vectorObjectOverrides?.[sourceLayer.uid]
        const canUseBitmapCache =
          docCx.hasLayerBitmapCache(sourceLayer.uid, requestSize) &&
          vectorObjectOverrides?.[sourceLayer.uid] == null

        if (canUseBitmapCache) {
          logger.info('Use cached bitmap for vector layer', sourceLayer.uid)

          layerBitmap = (await docCx.getOrCreateLayerBitmapCache(
            sourceLayer.uid,
            requestSize,
          ))!
        } else {
          logger.info(
            'Cache is invalidated, re-render vector layer',
            sourceLayer.uid,
          )

          const { layerBBox, objectsBBox } = await renderer.renderVectorLayer(
            tmpVectorOutCx.canvas,
            sourceLayer,
            {
              viewport,
              pixelRatio,
              objectOverrides: vectorObjectOverrides,
              abort,
              phase,
              logger,
            },
          )

          layerMetrics[sourceLayer.uid] = layerBBox
          for (const [uid, bbox] of Object.entries(objectsBBox)) {
            objectMetrics[uid] = bbox
          }

          if (abort?.aborted) throw new PaplicoAbortError()

          if (hasOverrideForThisLayer) {
            // For perfomance, avoid getImageData when using override
            const overrided = createContext2D()
            setCanvasSize(overrided.canvas, viewport)
            overrided.drawImage(tmpVectorOutCx.canvas, 0, 0)

            layerBitmap = overrided.canvas
          } else {
            layerBitmap = await docCx.updateOrCreateLayerBitmapCache(
              sourceLayer.uid,
              tmpVectorOutCx.getImageData(
                0,
                0,
                viewport.width,
                viewport.height,
              ),
            )
          }
        }
      } else {
        // TODO
        return null!
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
    filter: Omit<LayerFilter, 'enabled'>,
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
          abortIfNeeded: () => {
            if (abort?.aborted) throw new PaplicoAbortError()
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

import {
  CompositeMode,
  LayerEntity,
  LayerFilter,
  LayerNode,
  VectorGroup,
  VectorObject,
} from '@/Document'
import { DocumentContext } from './DocumentContext/DocumentContext'
import {
  VectorAppearance,
  VectorAppearanceExternal,
  VectorAppearanceFill,
  VectorAppearanceStroke,
} from '@/Document/LayerEntity/VectorAppearance'
import { PaplicoError } from '@/Errors/PaplicoError'

export type RenderTask = {
  source: RenderSource
  renderTarget: RenderTargets
  clearTarget?: true // defaults to false
  _debug?: Record<string, any>
} & (
  | {
      command: typeof RenderCommands.PRERENDER_SOURCE
    }
  | {
      command: typeof RenderCommands.DRAW_SOURCE_TO_DEST
      compositeMode: CompositeMode
      opacity: number
    }
  // | {
  //     command: typeof RenderCommands.DRAW_VECTOR_OBJECT
  //     // layerUid: string // use source.layerUid instead
  //     object: VectorObject
  //     compositeMode: CompositeMode
  //   }
  | {
      command: typeof RenderCommands.APPLY_LAYER_FILTER
      filter: LayerFilter
    }
  // | {
  //     command: typeof RenderCommands.SWAP_SOURCE_AND_TARGET
  //     middle: RenderTargets
  //   }
  | {
      command: typeof RenderCommands.APPLY_INTERNAL_OBJECT_FILTER
      layerUid: string
      object: VectorObject
      filter: VectorAppearanceFill | VectorAppearanceStroke
    }
  | {
      command: typeof RenderCommands.APPLY_EXTERNAL_OBJECT_FILTER
      layerUid: string
      objectUid: string
      filter: VectorAppearanceExternal
    }
  | {
      command: typeof RenderCommands.CLEAR_TARGET
    }
  | {
      command: typeof RenderCommands.FREE_TARGET
    }
  | {
      command: typeof RenderCommands.CACHE_SOUCE_AS_PRECOMPOSITE_LAYERS
      layerUids: string[]
    }
)

export const RenderCommands = km({
  DRAW_SOURCE_TO_DEST: null,
  PRERENDER_SOURCE: null,
  APPLY_LAYER_FILTER: null,
  APPLY_INTERNAL_OBJECT_FILTER: null,
  APPLY_EXTERNAL_OBJECT_FILTER: null,
  CLEAR_TARGET: null,
  FREE_TARGET: null,
  CACHE_SOUCE_AS_PRECOMPOSITE_LAYERS: null,
})
export type RenderCommands =
  (typeof RenderCommands)[keyof typeof RenderCommands]

export type CanvasToken = {
  __canvasToken: true
}

export const RenderTargets = km({
  LAYER_PRE_FILTER: null,
  VECTOR_OBJECT_PRE_FILTER: null,
  SHARED_FILTER_BUF: null,
  PREDEST: null,
  GL_RENDER_TARGET1: null,
  NONE: null,
})

export type RenderTargets =
  | (typeof RenderTargets)[keyof typeof RenderTargets]
  | CanvasToken

export type RenderSource =
  | RenderTargets
  | { layer: LayerEntity }
  | { bitmap: HTMLCanvasElement | ImageBitmap }
  | CanvasToken

const NEW_CANVAS_TARGET = (label?: string) => ({
  __canvasToken: true as const,
  label,
})

function km<T extends object>(obj: T): { [K in keyof T]: K } {
  return Object.keys(obj).reduce((acc, key) => {
    ;(acc as any)[key] = key as any
    return acc
  }, {}) as any
}

export function buildRenderSchedule(
  node: LayerNode,
  ctx: DocumentContext,
  {
    layerOverrides,
  }: {
    layerOverrides?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
  } = {},
) {
  const tasks: RenderTask[] = []
  const preResolvedLayers = new Map<string, LayerEntity>()

  // Pre-rendering tasks
  for (const child of node.children) {
    const layerRef = ctx.resolveLayer(child.layerUid)
    const layer = layerRef?.source.deref()
    if (!layerRef || !layer) continue

    if (layer.layerType === 'reference') {
      const refLayer = ctx.resolveLayer(layer.referencedLayerId)?.source.deref()
      if (!refLayer) continue

      preResolvedLayers.set(layer.uid, refLayer)

      if (
        refLayer.layerType === 'reference' &&
        refLayer.referencedLayerId === layer.uid
      ) {
        console.warn(
          `Circular reference detected ${layer.uid} <-> ${refLayer.uid}}`,
        )
        continue
      }

      tasks.push({
        command: RenderCommands.PRERENDER_SOURCE,
        source: { layer },
        renderTarget: RenderTargets.NONE,
        _debug: [`referenced from ${layer.uid}`],
      })
    }
  }

  tasks.push({
    command: RenderCommands.CLEAR_TARGET,
    source: RenderTargets.NONE,
    renderTarget: RenderTargets.PREDEST,
    _debug: ['initial'],
  })

  // Rendering tasks
  for (const child of node.children) {
    const layerRef = ctx.resolveLayer(child.layerUid)
    const layer = layerRef?.source.deref()
    if (!layerRef || !layer) continue
    if (!layer.visible || layer.opacity <= 0) continue

    const hasLayerFilter =
      layer.filters.length > 0 &&
      layer.filters.some((f) => f.enabled && f.opacity > 0)

    // Has layer overrides
    if (layerOverrides?.[layer.uid]) {
      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: { bitmap: layerOverrides[layer.uid] },
        renderTarget: hasLayerFilter
          ? RenderTargets.LAYER_PRE_FILTER
          : RenderTargets.PREDEST,
        compositeMode: hasLayerFilter ? 'normal' : layer.compositeMode,
        opacity: hasLayerFilter ? 1 : layer.opacity,
        _debug: ['hasLayerOverrides'],
      })
    }
    // Raster layer
    else if (layer.layerType === 'raster') {
      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: { layer },
        renderTarget: hasLayerFilter
          ? RenderTargets.LAYER_PRE_FILTER
          : RenderTargets.PREDEST,
        compositeMode: hasLayerFilter ? 'normal' : layer.compositeMode,
        opacity: hasLayerFilter ? 1 : layer.opacity,
        _debug: ['raster', hasLayerFilter ? 'hasLayerFilter' : ''],
      })
    }
    // Vector layer
    else if (layer.layerType === 'vector') {
      //
      // Vector render strategy
      //
      // 1. Dest target to **PREDEST** directly (Direct Output) and end layer composite process after objects rendererd
      //    if vector layer is normal composite and layrer not has filter,
      //    reason: If drawing directly to PREDEST is layer-aggregated and the result
      //            is no different from compositing, the number of canvases used can be reduced
      //    1-1. else, Dest target to **LAYER_PRE_FILTER** for aggregate layer's object content.
      //         if vector layer isn't normal composite or layer has filter,
      //         needs to aggregate layer content before composite to PRE_FILTER.
      //      reason: if "Vector layer" (not object) has special composite mode,
      //              final color not determinate while end of render for all objects.
      //　　　..Possible to target this section: PREDEST, LAYER_PRE_FILTER
      // 2. loop processing objects in layer (scheduleForTree)
      // | 2-1. if object is vectorGroup,
      // |      create new render target **VECTOR_GROUP_AGGREGATE_TARGET** and render child objects to it
      // |    reason: If nested within a vectorGroup, using an existing buffer may overwrite
      // |            the buffer used by the ancestor render process.
      // |    TODO: There is a possibility to Direct Output to the parent renderTarget,
      // |          but I don't think it has been implemented yet.
      // |    TODO: If vectorGroup not has nested vectorGroup and normal composite mode,
      // |          may be able to Direct Output to CONTAIENR_GROUP_RENDER_TARGET.
      // |    ..Possible to target this section,  VECTOR_GROUP_AGGREGATE_TARGET (next CONTAIENR_GROUP_RENDER_TARGET)
      // |     2-1-2. Dest to **VECTOR_OBJECT_PRE_FILTER** from VECTOR_GROUP_AGGREGATE_TARGET
      // |            on finish to render child objects
      // | 2-2. if object is vectorObject,
      // |     2-2-1. Dest to **CONTAIENR_GROUP_RENDER_TARGET**, if object only has internal filter
      // |     2-2-２-1. Dest to **VECTOR_OBJECT_PRE_FILTER**, if object has external filter,
      // |               Render internal filter and external filter to it.
      // |               And using **SHARED_FILTER_BUF** as swap buffer for extenal filter processing.
      // |               (VECTOR_OBJECT_PRE_FILTER <-> SHARED_FILTER_BUF)
      // |         Last result should be render into VECTOR_OBJECT_PRE_FILTER.
      // |     2-2-2-2. copy to **LAYER_PRE_FILTER** result of VECTOR_OBJECT_PRE_FILTER
      // |     2-2-2-3. clear VECTOR_OBJECT_PRE_FILTER
      // | 2-3. CLEAR SHARED_FILTER_BUF
      // └ 2-4. apply group filters on VECTOR_OBJECT_PRE_FILTER <-> SHARED_FILTER_BUF
      //   2-5. draw VECTOR_OBJECT_PRE_FILTER to LAYER_PRE_FILTER with composite mode and opacity

      if (layer.objects.length === 0) continue

      let canLayerDirectOutput =
        layer.compositeMode === 'normal' && !hasLayerFilter

      const vectorLayerOut = hasLayerFilter
        ? RenderTargets.LAYER_PRE_FILTER
        : RenderTargets.PREDEST

      for (const object of layer.objects) {
        scheduleForTree(vectorLayerOut, object, canLayerDirectOutput)
      }

      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: vectorLayerOut,
        renderTarget: canLayerDirectOutput
          ? RenderTargets.PREDEST
          : RenderTargets.LAYER_PRE_FILTER,
        compositeMode: layer.compositeMode,
        opacity: 1,
        _debug: ['vector layer tail'],
      })

      // #region scheduleForTree
      function scheduleForTree(
        CONTAIENR_GROUP_RENDER_TARGET: RenderTargets,
        object: VectorObject | VectorGroup,
        isParentUseDirectOutput: boolean = true,
      ) {
        if (!object.visible) return

        const objHasExternalFilter = object.filters.some((f) => {
          return f.kind === 'external' && f.enabled
        })

        const canObjDirectOutput =
          isParentUseDirectOutput &&
          object.compositeMode === 'normal' &&
          !objHasExternalFilter

        const CURRENT_VECTOR_GROUP_AGGREGATE_TARGET = NEW_CANVAS_TARGET(
          `nodeedge ${object.uid}`,
        )

        if (object.type === 'vectorGroup') {
          scheduleForTree(
            canObjDirectOutput
              ? CONTAIENR_GROUP_RENDER_TARGET
              : CURRENT_VECTOR_GROUP_AGGREGATE_TARGET,
            object,
            canObjDirectOutput,
          )

          if (!canObjDirectOutput) {
            // if not direct output, draw aggregated result to CONTAIENR_GROUP_RENDER_TARGET
            tasks.push(
              {
                command: RenderCommands.DRAW_SOURCE_TO_DEST,
                source: CURRENT_VECTOR_GROUP_AGGREGATE_TARGET,
                renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
                compositeMode: object.compositeMode,
                opacity: object.opacity,
                _debug: [
                  'scheduleForTree',
                  'vectorGroup',
                  'disableDirectOutput',
                ],
              },
              {
                command: RenderCommands.FREE_TARGET,
                source: RenderTargets.NONE,
                renderTarget: CURRENT_VECTOR_GROUP_AGGREGATE_TARGET,
                _debug: [
                  'scheduleForTree',
                  'vectorGroup',
                  'disableDirectOutput',
                ],
              },
            )
          }
        }

        // Clear before using external filter
        if (objHasExternalFilter) {
          tasks.push({
            command: RenderCommands.CLEAR_TARGET,
            source: RenderTargets.NONE,
            renderTarget: RenderTargets.SHARED_FILTER_BUF,
            _debug: [
              'scheduleForTree',
              'anyObject',
              'objHasExternalFilter',
              'prefiltering-internal-external',
            ],
          })
        }

        // Processing internal & external object filters
        for (const filter of object.filters) {
          if (!filter.enabled) continue

          if (filter.kind !== 'external') {
            // internal filters
            tasks.push({
              command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
              source: RenderTargets.NONE,
              renderTarget: canObjDirectOutput
                ? RenderTargets.PREDEST
                : RenderTargets.VECTOR_OBJECT_PRE_FILTER,
              layerUid: child.layerUid,
              object,
              filter,
              _debug: ['scheduleForTree', 'internalFilterProceed'],
            })
          } else {
            // render external filters

            if (filter.processor.opacity <= 0) continue
            if (canObjDirectOutput) {
              throw new PaplicoError(
                `Invioation of external filter on object ${object.uid} is not allowed in direct output `,
              )
            }

            tasks.push(
              {
                command: RenderCommands.APPLY_EXTERNAL_OBJECT_FILTER,
                source: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
                renderTarget: RenderTargets.SHARED_FILTER_BUF,
                layerUid: child.layerUid,
                objectUid: object.uid,
                filter,
                _debug: ['scheduleForTree', 'anyObject', 'externalFilter'],
              },
              {
                command: RenderCommands.DRAW_SOURCE_TO_DEST,
                source: RenderTargets.SHARED_FILTER_BUF,
                renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
                compositeMode: 'normal',
                opacity: filter.processor.opacity,
                _debug: ['scheduleForTree', 'anyObject', 'externalFilter'],
              },
            )
          }
        }

        if (!canObjDirectOutput) {
          tasks.push({
            command: RenderCommands.DRAW_SOURCE_TO_DEST,
            source: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
            renderTarget: RenderTargets.LAYER_PRE_FILTER,
            compositeMode: object.compositeMode,
            opacity: object.opacity,
            _debug: ['scheduleForTree', 'anyObject', '!canObjDirectOutput'],
          })
        }
      }
      // #endregion
    } else if (layer.layerType === 'text') {
      if (layer.textNodes.length === 0) continue

      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: { layer },
        renderTarget: hasLayerFilter
          ? RenderTargets.LAYER_PRE_FILTER
          : RenderTargets.PREDEST,
        compositeMode: layer.compositeMode,
        opacity: layer.opacity,
      })
    } else if (layer.layerType === 'reference') {
      const referencedLayer = preResolvedLayers.get(layer.uid)
      if (!referencedLayer) continue

      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: { layer: referencedLayer },
        renderTarget: hasLayerFilter
          ? RenderTargets.LAYER_PRE_FILTER
          : RenderTargets.PREDEST,
        compositeMode: layer.compositeMode,
        opacity: layer.opacity,
      })
    }

    // Apply layer filters
    if (hasLayerFilter) {
      for (const layerFilter of layer.filters) {
        if (!layerFilter.enabled) continue

        tasks.push(
          {
            command: RenderCommands.CLEAR_TARGET,
            source: RenderTargets.NONE,
            renderTarget: RenderTargets.SHARED_FILTER_BUF,
          },
          {
            command: RenderCommands.APPLY_LAYER_FILTER,
            source: RenderTargets.LAYER_PRE_FILTER,
            renderTarget: RenderTargets.SHARED_FILTER_BUF,
            filter: layerFilter,
          },
          {
            command: RenderCommands.CLEAR_TARGET,
            source: RenderTargets.NONE,
            renderTarget: RenderTargets.LAYER_PRE_FILTER,
          },
          {
            command: RenderCommands.DRAW_SOURCE_TO_DEST,
            source: RenderTargets.SHARED_FILTER_BUF,
            renderTarget: RenderTargets.LAYER_PRE_FILTER,
            compositeMode: 'normal',
            opacity: 1,
          },
        )
      }

      tasks.push(
        {
          command: RenderCommands.DRAW_SOURCE_TO_DEST,
          source: RenderTargets.LAYER_PRE_FILTER,
          renderTarget: RenderTargets.PREDEST,
          compositeMode: layer.compositeMode,
          opacity: layer.opacity,
        },
        {
          command: RenderCommands.CLEAR_TARGET,
          source: RenderTargets.NONE,
          renderTarget: RenderTargets.SHARED_FILTER_BUF,
        },
      )
    }
  }

  if (process.env.NODE_ENV === 'test') {
    tasks.forEach((t, i) => {
      tasks[i] = Object.assign({ i }, t)
    })
  }

  // let cacheLimit = 5
  // let cacheScheduledTasks = []
  // let cachingLayerUids = new Set<string>()
  // for (const task of tasks) {
  //   if (task.command === RenderCommands.DRAW_SOURCE_TO_DEST) {
  //     if (
  //       task.meta?.vectorCanNotLayerDirectOutput &&
  //       task.renderTarget === RenderTargets.PREDEST
  //     ) {
  //       cacheScheduledTasks.push(task)
  //       cachingLayerUids.add(task.source.layer.uid)
  //     }
  //   } else if (task.command === RenderCommands.CLEAR_TARGET) {
  //     if (cachingLayerUids.has(task.renderTarget.layerUid)) {
  //       cacheScheduledTasks.push(task)
  //     }
  //   }
  // }

  return { tasks, stats: { usingCanvaes: 1 } }
}

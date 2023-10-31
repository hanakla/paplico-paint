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
  renderTarget: RenderTargets | NewCanvasTarget
  clearTarget?: true // defaults to false
  meta?: Record<string, any>
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
)

export const RenderCommands = km({
  DRAW_SOURCE_TO_DEST: null,
  PRERENDER_SOURCE: null,
  // DRAW_VECTOR_OBJECT: null,
  APPLY_LAYER_FILTER: null,
  APPLY_INTERNAL_OBJECT_FILTER: null,
  APPLY_EXTERNAL_OBJECT_FILTER: null,
  // SWAP_SOURCE_AND_TARGET: null,
  CLEAR_TARGET: null,
  FREE_TARGET: null,
})

export type RenderCommands =
  (typeof RenderCommands)[keyof typeof RenderCommands]

export type NewCanvasTarget = { __newTarget: true; (): { __targetToken: true } }

export type RenderSource =
  | RenderTargets
  | { layer: LayerEntity }
  | { bitmap: HTMLCanvasElement | ImageBitmap }
  | NewCanvasTarget

export const RenderTargets = Object.assign(
  km({
    PRE_FILTER: null,
    VECTOR_PRE_FILTER: null,
    SHARED_FILTER_BUF: null,
    PREDEST: null,
    GL_RENDER_TARGET1: null,
    NONE: null,
  }),
  {
    NEW_TARGET: Object.assign(
      () => ({
        __targetToken: true as const,
      }),
      { __newTarget: true as const },
    ) satisfies NewCanvasTarget,
  },
)
export type RenderTargets = (typeof RenderTargets)[keyof typeof RenderTargets]

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
      })
    }
  }

  tasks.push({
    command: RenderCommands.CLEAR_TARGET,
    source: RenderTargets.NONE,
    renderTarget: RenderTargets.PREDEST,
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

    if (layerOverrides?.[layer.uid]) {
      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: { bitmap: layerOverrides[layer.uid] },
        renderTarget: hasLayerFilter
          ? RenderTargets.PRE_FILTER
          : RenderTargets.PREDEST,
        compositeMode: layer.compositeMode,
        opacity: layer.opacity,
      })
    } else if (layer.layerType === 'raster') {
      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: { layer },
        renderTarget: hasLayerFilter
          ? RenderTargets.SHARED_FILTER_BUF
          : RenderTargets.PREDEST,
        compositeMode: layer.compositeMode,
        opacity: layer.opacity,
      })
    } else if (layer.layerType === 'vector') {
      if (layer.objects.length === 0) continue

      let canLayerDirectOutput =
        layer.compositeMode === 'normal' && !hasLayerFilter

      const scheduleForTree = (
        parentOut: RenderTargets,
        object: VectorObject | VectorGroup,
        useDirectOutput: boolean = true,
      ) => {
        const objHasExternalFilter = object.filters.some((f) => {
          return f.kind === 'external' && f.enabled && f.processor.opacity > 0
        })

        const canObjDirectOutput =
          useDirectOutput &&
          layer.compositeMode === 'normal' &&
          !objHasExternalFilter

        if (object.type === 'vectorGroup') {
          scheduleForTree(parentOut, object, canObjDirectOutput)
        }

        if (object.type === 'vectorObject') {
          if (!object.visible) return
          if (object.opacity <= 0) return

          if (!canObjDirectOutput) {
            // when canObjDirectOutput == false, VECTOR_PRE_FILTER buffer will use
            tasks.push({
              command: RenderCommands.CLEAR_TARGET,
              source: RenderTargets.NONE,
              renderTarget: RenderTargets.VECTOR_PRE_FILTER,
            })
          }

          for (const filter of object.filters) {
            if (!filter.enabled) continue

            if (filter.kind !== 'external') {
              // internal filters
              tasks.push({
                command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
                source: RenderTargets.NONE,
                renderTarget: canObjDirectOutput
                  ? parentOut
                  : RenderTargets.VECTOR_PRE_FILTER,
                object,
                filter,
              })
            } else {
              if (filter.processor.opacity <= 0) continue
              if (canObjDirectOutput) {
                throw new PaplicoError(
                  `Invioation of external filter on object ${object.uid} is not allowed in direct output `,
                )
              }

              tasks.push(
                {
                  command: RenderCommands.APPLY_EXTERNAL_OBJECT_FILTER,
                  source: RenderTargets.VECTOR_PRE_FILTER,
                  renderTarget: RenderTargets.SHARED_FILTER_BUF,
                  filter,
                  layerUid: child.layerUid,
                  objectUid: object.uid,
                },
                {
                  command: RenderCommands.DRAW_SOURCE_TO_DEST,
                  source: RenderTargets.SHARED_FILTER_BUF,
                  renderTarget: RenderTargets.VECTOR_PRE_FILTER,
                  compositeMode: 'normal',
                  opacity: filter.processor.opacity,
                },
              )
            }
          }

          if (!canObjDirectOutput) {
            tasks.push({
              command: RenderCommands.DRAW_SOURCE_TO_DEST,
              source: RenderTargets.VECTOR_PRE_FILTER,
              renderTarget: RenderTargets.PRE_FILTER,
              compositeMode: object.compositeMode,
              opacity: object.opacity,
            })
          }
        }
      }

      const vectorOut = hasLayerFilter
        ? RenderTargets.SHARED_FILTER_BUF
        : RenderTargets.PREDEST

      for (const object of layer.objects) {
        scheduleForTree(vectorOut, object, canLayerDirectOutput)
      }

      // if (!canLayerDirectOutput) {
      //   tasks.push({
      //     command: RenderCommands.DRAW_SOURCE_TO_DEST,
      //     source: RenderTargets.PREDEST,
      //     renderTarget: vectorOut,
      //     compositeMode: layer.compositeMode,
      //     opacity: 1,
      //   })
      // }
    } else if (layer.layerType === 'text') {
      if (layer.textNodes.length === 0) continue

      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: { layer },
        renderTarget: hasLayerFilter
          ? RenderTargets.PRE_FILTER
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
          ? RenderTargets.PRE_FILTER
          : RenderTargets.PREDEST,
        compositeMode: layer.compositeMode,
        opacity: layer.opacity,
      })
    }

    // Apply layer filters
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
          source: RenderTargets.PRE_FILTER,
          renderTarget: RenderTargets.SHARED_FILTER_BUF,
          filter: layerFilter,
        },
        {
          command: RenderCommands.CLEAR_TARGET,
          source: RenderTargets.NONE,
          renderTarget: RenderTargets.PRE_FILTER,
        },
        {
          command: RenderCommands.DRAW_SOURCE_TO_DEST,
          source: RenderTargets.SHARED_FILTER_BUF,
          renderTarget: RenderTargets.PRE_FILTER,
          compositeMode: 'normal',
          opacity: 1,
        },
      )
    }

    if (hasLayerFilter) {
      tasks.push(
        {
          command: RenderCommands.DRAW_SOURCE_TO_DEST,
          source: RenderTargets.PRE_FILTER,
          renderTarget: RenderTargets.PREDEST,
          compositeMode: layer.compositeMode,
          opacity: 1,
        },
        {
          command: RenderCommands.CLEAR_TARGET,
          source: RenderTargets.NONE,
          renderTarget: RenderTargets.SHARED_FILTER_BUF,
        },
      )
    }
  }

  return tasks
}

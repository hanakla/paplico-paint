import { PaplicoDocument, VisuElement, VisuFilter } from '@/Document'

export type RenderTask = {
  source: RenderSource
  renderTarget: RenderTargets

  /** slash joined node path.
   * if have cache for this key, must be ignore this command */
  // skipIfHasCacheFor?: string
  _cacheHint?: {
    usingLayerOverride?: boolean
  }
  _debug?: Record<string, any>
} & (
  | {
      command: typeof RenderCommands.PRERENDER_SOURCE
    }
  | {
      command: typeof RenderCommands.DRAW_SOURCE_TO_DEST
      blendMode: VisuElement.BlendMode
      opacity: number
    }
  | {
      command: typeof RenderCommands.DRAW_VISU_TO_DEST
      blendMode: VisuElement.BlendMode
      opacity: number
      parentTransform?: VisuElement.ElementTransform
    }
  | {
      source: null
      command: typeof RenderCommands.DRAW_BITMAP_CACHE_TO_DEST
      blendMode: VisuElement.BlendMode
      opacity: number
      cacheKeyVisuUid: string
      // parentTransform?: VisuElement.ElementTransform
    }
  | {
      command: typeof RenderCommands.DRAW_OVERRIDED_SOURCE_TO_DEST
      sourceVisu: VisuElement.GroupElement | VisuElement.CanvasElement
      blendMode: VisuElement.BlendMode
      opacity: number
      parentTransform: VisuElement.ElementTransform
    }
  // | {
  //     command: typeof RenderCommands.DRAW_VECTOR_OBJECT
  //     // layerUid: string // use source.layerUid instead
  //     object: VectorObject
  //     compositeMode: CompositeMode
  //   }
  | {
      command: typeof RenderCommands.APPLY_LAYER_FILTER
      filter: VisuFilter.Structs.PostProcessSetting<any>
    }
  // | {
  //     command: typeof RenderCommands.SWAP_SOURCE_AND_TARGET
  //     middle: RenderTargets
  //   }
  | {
      source: null
      command: typeof RenderCommands.APPLY_INTERNAL_OBJECT_FILTER
      objectVisu: VisuElement.VectorObjectElement | VisuElement.TextElement
      filter: VisuFilter.FillFilter | VisuFilter.StrokeFilter
      parentTransform: VisuElement.ElementTransform
    }
  | {
      command: typeof RenderCommands.APPLY_POSTPROCESS_FILTER
      filter: VisuFilter.PostProcessFilter<any>
    }
  | {
      source: null
      command: typeof RenderCommands.CLEAR_TARGET
      setSize?: 'VIEWPORT'
    }
  | {
      command: typeof RenderCommands.FREE_TARGET
    }
  | {
      command: typeof RenderCommands.CACHE_SOUCE_AS_PRECOMPOSITE_LAYERS
      cachedNodePaths: Array<string[]>
    }
)

export type SkippableVisuesMap = {
  [uid: string]: { cacheKey: string } | undefined
}

export const RenderCommands = km({
  DRAW_SOURCE_TO_DEST: null,
  DRAW_OVERRIDED_SOURCE_TO_DEST: null,
  DRAW_VISU_TO_DEST: null,
  DRAW_BITMAP_CACHE_TO_DEST: null,
  DRAW_PREFILTER_VISU_TO_DEST: null,
  PRERENDER_SOURCE: null,
  APPLY_LAYER_FILTER: null,
  APPLY_INTERNAL_OBJECT_FILTER: null,
  APPLY_POSTPROCESS_FILTER: null,
  CLEAR_TARGET: null,
  FREE_TARGET: null,
  CACHE_SOUCE_AS_PRECOMPOSITE_LAYERS: null,
})
export type RenderCommands =
  (typeof RenderCommands)[keyof typeof RenderCommands]

export type CanvasToken = {
  __canvasToken: true
}

export const NEW_CANVAS_TARGET = (
  label?: string,
): CanvasToken & { label?: string } => ({
  label,
  __canvasToken: true as const,
})

// Value is unique object, it usually used as key of Map
export const RenderTargets = {
  LAYER_PRE_FILTER: NEW_CANVAS_TARGET('LAYER_PRE_FILTER'),
  VECTOR_OBJECT_PRE_FILTER: NEW_CANVAS_TARGET('VECTOR_OBJECT_PRE_FILTER'),
  SHARED_FILTER_BUF: NEW_CANVAS_TARGET('SHARED_FILTER_BUF'),
  PREDEST: NEW_CANVAS_TARGET('PREDEST'),
  NONE: null,
} as const

export type RenderTargets =
  | (typeof RenderTargets)[keyof typeof RenderTargets]
  | CanvasToken

export type RenderSource =
  | RenderTargets
  | { visuNode: PaplicoDocument.ResolvedLayerNode }
  | { bitmap: HTMLCanvasElement | ImageBitmap }
  | CanvasToken

function km<T extends object>(obj: T): { [K in keyof T]: K } {
  return Object.keys(obj).reduce((acc, key) => {
    ;(acc as any)[key] = key as any
    return acc
  }, {}) as any
}

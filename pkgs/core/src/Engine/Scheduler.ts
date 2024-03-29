import { PaplicoDocument, VisuElement } from '@/Document'
import {
  CanvasToken,
  NEW_CANVAS_TARGET,
  RenderCommands,
  RenderTargets,
  RenderTask,
  SkippableVisuesMap,
} from './Scheduler.Const'
import { DocumentContext } from './DocumentContext/DocumentContext'
import { type RenderPipeline } from './RenderPipeline'
import { VectorRenderer } from './VectorRenderer'
import { DEFAULT_VISU_TRANSFORM } from '@/Document/Visually/factory'
import { composeVisuTransforms } from './VectorUtils'
import { LogChannel } from '@/Debugging/LogChannel'

export function buildRenderSchedule(
  node: PaplicoDocument.ResolvedLayerNode,
  docx: DocumentContext,
  {
    layerNodeOverrides, // prevCacheBreakerNodes = {},
    willRenderingViewport,
    offsetTransform = DEFAULT_VISU_TRANSFORM(),
  }: {
    layerNodeOverrides?: RenderPipeline.LayerNodeOverrides
    // prevCacheBreakerNodes?: { [slashJoinedPath: string]: boolean }
    willRenderingViewport: {
      left: number
      top: number
      width: number
      height: number
    }
    /** Transform to Node's parent */
    offsetTransform?: VisuElement.ElementTransform
  },
) {
  const tasks: RenderTask[] = []

  // const preResolvedLayerNodes = new Map<string, VisuElement.AnyElement>()

  // Pre-rendering tasks
  // for (const child of node.children) {
  //   const visu = child.visu

  //   if (visu.type === 'reference' && visu.referenceNodePath) {
  //     const refNode = docx.document.layerNodes.getResolvedLayerNodes(
  //       visu.referenceNodePath,
  //     )

  //     if (!refNode) continue
  //     preResolvedLayerNodes.set(visu.uid, refNode.visu)

  //     if (
  //       refNode.visu.type === 'reference' &&
  //       refNode.visu.referenceNodePath?.at(-1) === visu.uid
  //     ) {
  //       console.warn(
  //         `Circular reference detected ${visu.uid} <-> ${refNode.uid}}`,
  //       )
  //       continue
  //     }

  //     tasks.push({
  //       command: RenderCommands.PRERENDER_SOURCE,
  //       source: { visuNode: refNode },
  //       renderTarget: RenderTargets.NONE,
  //       _debug: [`referenced from ${visu.uid}`],
  //     })
  //   }
  // }

  // const preComposableVisues: SkippableVisuesMap =
  //   (function compulePreComposables(
  //     flatNodes: PaplicoDocument.ResolvedLayerNode[],
  //   ) {
  //     let precomposables = {}
  //     let groups: Array<string[]> = []
  //     let currentPreCompGroup: string[] = []

  //     const commitCurrentPreCompGroup = () => {
  //       let key = { cacheKey: currentPreCompGroup.join('/') }
  //       currentPreCompGroup.forEach((uid) => (preComposableVisues[uid] = key))
  //       currentPreCompGroup = []
  //     }

  //     // unprecomposable conditions:
  //     // - visu has layer overrides
  //     // - visu has layer changed from previous (bitmap cache miss)
  //     // - group visu with changed children
  //     // - filter visu with changed under sibling(s)
  //     // - non-normal blend mode vith with changed under sibling(s)
  //     // thinking:
  //     // - visues under filter layer (?)
  //     for (let idx = 0; idx < flatNodes.length; idx++) {
  //       const node = flatNodes[idx]
  //       const visu = node.visu

  //       // if (visueHasChange) {
  //       //   commitCurrentGroup()
  //       //   continue
  //       // }

  //       if (visu.type === 'group') {
  //         currentPreCompGroup.push(visu.uid)
  //       } else if (visu.type === 'canvas') {
  //         if (layerNodeOverrides?.[visu.uid]) {
  //           commitCurrentPreCompGroup()
  //           continue
  //         }

  //       }
  //     }

  //     return {}
  //   })(flattenResolvedNode(node))

  tasks.push({
    command: RenderCommands.CLEAR_TARGET,
    source: RenderTargets.NONE,
    renderTarget: RenderTargets.PREDEST,
    _debug: ['initial'],
  })
  ;(function scheduleForTree(
    groupRenderTarget: RenderTargets,
    node: PaplicoDocument.ResolvedLayerNode,
    parentTransform: VisuElement.ElementTransform,
    parentVisible: boolean,
  ): void {
    const nodeVisu = node.visu

    if (!parentVisible) return
    if (nodeVisu.visible == false || nodeVisu.opacity === 0) return
    LogChannel.l.pipelineSchedule(node, parentTransform)

    const hasPostProcessFilter = nodeVisu.filters.some((f) => {
      return f.kind === 'postprocess' && f.enabled && f.processor.opacity > 0
    })

    const [canUseGroupRenderTarget, CHILDREN_AGGREGATE_TARGET] = [
      nodeVisu.blendMode === 'normal' && !hasPostProcessFilter,
      NEW_CANVAS_TARGET(),
    ] as [true, null] | [false, CanvasToken]

    if (hasPostProcessFilter) {
      tasks.push({
        command: RenderCommands.CLEAR_TARGET,
        source: RenderTargets.NONE,
        renderTarget: RenderTargets.LAYER_PRE_FILTER,
        setSize: 'VIEWPORT',
      })
    }

    if (
      layerNodeOverrides?.[node.uid] &&
      (nodeVisu.type === 'group' || nodeVisu.type === 'canvas')
    ) {
      tasks.push({
        command: RenderCommands.DRAW_OVERRIDED_SOURCE_TO_DEST,
        source: { bitmap: layerNodeOverrides[node.uid] },
        renderTarget: canUseGroupRenderTarget
          ? groupRenderTarget
          : RenderTargets.LAYER_PRE_FILTER,
        blendMode: nodeVisu.blendMode,
        opacity: nodeVisu.opacity,
        sourceVisu: nodeVisu,
        parentTransform,
        _cacheHint: {
          usingLayerOverride: true,
        },
        _debug: ['hasLayerOverrides'],
      })
    } else if (
      nodeVisu.type === 'group' &&
      docx.hasLayerNodeBitmapCache(node.uid, willRenderingViewport)
    ) {
      tasks.push({
        command: RenderCommands.DRAW_BITMAP_CACHE_TO_DEST,
        source: RenderTargets.NONE,
        renderTarget: canUseGroupRenderTarget
          ? groupRenderTarget
          : RenderTargets.LAYER_PRE_FILTER,
        blendMode: nodeVisu.blendMode,
        opacity: nodeVisu.opacity,
        cacheKeyVisuUid: node.uid,
      })
    } else if (nodeVisu.type === 'group') {
      for (const child of node.children) {
        if (!child.visu.visible) continue

        scheduleForTree(
          canUseGroupRenderTarget
            ? groupRenderTarget
            : CHILDREN_AGGREGATE_TARGET,
          child,
          composeVisuTransforms(parentTransform, nodeVisu.transform),
          parentVisible && nodeVisu.visible,
        )
      }

      if (!canUseGroupRenderTarget) {
        tasks.push({
          command: RenderCommands.DRAW_SOURCE_TO_DEST,
          source: CHILDREN_AGGREGATE_TARGET,
          renderTarget: RenderTargets.LAYER_PRE_FILTER,
          blendMode: nodeVisu.blendMode,
          opacity: nodeVisu.opacity,
          _debug: ['group', 'disableDirectOutput'],
        })
      }
    } else if (nodeVisu.type === 'vectorObject') {
      // Later
    } else if (nodeVisu.type === 'canvas') {
      tasks.push({
        command: RenderCommands.DRAW_VISU_TO_DEST,
        source: { visuNode: node },
        renderTarget: canUseGroupRenderTarget
          ? groupRenderTarget
          : RenderTargets.LAYER_PRE_FILTER,
        blendMode: nodeVisu.blendMode,
        opacity: nodeVisu.opacity,
        parentTransform,
        _debug: ['canvas'],
      })
    } else if (nodeVisu.type === 'text') {
      tasks.push({
        command: RenderCommands.DRAW_VISU_TO_DEST,
        source: { visuNode: node },
        renderTarget: canUseGroupRenderTarget
          ? groupRenderTarget
          : RenderTargets.LAYER_PRE_FILTER,
        blendMode: nodeVisu.blendMode,
        opacity: nodeVisu.opacity,
        _debug: ['text'],
        parentTransform,
      })
    }

    if (hasPostProcessFilter) {
      tasks.push({
        command: RenderCommands.CLEAR_TARGET,
        source: RenderTargets.NONE,
        renderTarget: RenderTargets.SHARED_FILTER_BUF,
        setSize: 'VIEWPORT',
      })
    }

    for (const filter of nodeVisu.filters) {
      if (!filter.enabled) continue

      if (filter.kind !== 'postprocess') {
        if (nodeVisu.type === 'vectorObject' || nodeVisu.type === 'text') {
          // internal filters
          tasks.push({
            command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
            source: null,
            renderTarget: canUseGroupRenderTarget
              ? groupRenderTarget
              : RenderTargets.LAYER_PRE_FILTER,
            objectVisu: nodeVisu,
            filter,
            parentTransform,
            _debug: ['internalFilterProceed'],
          })
        } else {
          console.warn(
            'internal filter not supported for ',
            nodeVisu.type,
            nodeVisu,
          )
        }
      } else {
        if (filter.processor.opacity <= 0) continue

        tasks.push(
          {
            command: RenderCommands.APPLY_POSTPROCESS_FILTER,
            source: RenderTargets.LAYER_PRE_FILTER,
            renderTarget: RenderTargets.SHARED_FILTER_BUF,
            filter: filter,
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
            blendMode: 'normal',
            opacity: filter.processor.opacity,
          },
          {
            command: RenderCommands.CLEAR_TARGET,
            source: RenderTargets.NONE,
            renderTarget: RenderTargets.SHARED_FILTER_BUF,
          },
        )
      }
    }

    if (!canUseGroupRenderTarget) {
      tasks.push({
        command: RenderCommands.DRAW_SOURCE_TO_DEST,
        source: RenderTargets.LAYER_PRE_FILTER,
        renderTarget: groupRenderTarget,
        blendMode: nodeVisu.blendMode,
        opacity: nodeVisu.opacity,
      })
    }
  })(
    RenderTargets.PREDEST,
    node,
    composeVisuTransforms(offsetTransform, node.visu.transform),
    node.visu.visible,
  )

  return { tasks, stats: { usingCanvaes: 1 } }
}

function flattenResolvedNode(node: PaplicoDocument.ResolvedLayerNode) {
  const nodes: PaplicoDocument.ResolvedLayerNode[] = []

  ;(function flatProc(node: PaplicoDocument.ResolvedLayerNode) {
    nodes.push(node)
    node.children.forEach((n) => flatProc(n))
  })(node)

  return nodes
}

// // Rendering tasks
// for (const child of node.children) {
//   const vis = child.visually
//   if (!vis.visible || vis.opacity <= 0) continue

//   const hasLayerFilter =
//     vis.filters.length > 0 &&
//     vis.filters.some(
//       (f) => f.enabled && f.kind === 'external' && f.processor.opacity > 0,
//     )

//   // Has layer overrides
//   if (layerOverrides?.[vis.uid]) {
//     tasks.push({
//       command: RenderCommands.DRAW_SOURCE_TO_DEST,
//       source: { bitmap: layerOverrides[vis.uid] },
//       renderTarget: hasLayerFilter
//         ? RenderTargets.LAYER_PRE_FILTER
//         : RenderTargets.PREDEST,
//       blendMode: hasLayerFilter ? 'normal' : vis.blendMode,
//       opacity: hasLayerFilter ? 1 : vis.opacity,
//       _debug: ['hasLayerOverrides'],
//     })
//   }
//   // Raster layer
//   else if (vis.type === 'canvas') {
//     tasks.push({
//       command: RenderCommands.DRAW_SOURCE_TO_DEST,
//       source: { visually: vis },
//       renderTarget: hasLayerFilter
//         ? RenderTargets.LAYER_PRE_FILTER
//         : RenderTargets.PREDEST,
//       blendMode: hasLayerFilter ? 'normal' : vis.blendMode,
//       opacity: hasLayerFilter ? 1 : vis.opacity,
//       _debug: ['raster', hasLayerFilter ? 'hasLayerFilter' : ''],
//     })
//   }
//   // Vector layer
//   else if (vis.type === 'vectorObject') {
//     //
//     // Vector render strategy
//     //
//     // 1. Dest target to **PREDEST** directly (Direct Output) and end layer composite process after objects rendererd
//     //    if vector layer is normal composite and layrer not has filter,
//     //    reason: If drawing directly to PREDEST is layer-aggregated and the result
//     //            is no different from compositing, the number of canvases used can be reduced
//     //    1-1. else, Dest target to **LAYER_PRE_FILTER** for aggregate layer's object content.
//     //         if vector layer isn't normal composite or layer has filter,
//     //         needs to aggregate layer content before composite to PRE_FILTER.
//     //      reason: if "Vector layer" (not object) has special composite mode,
//     //              final color not determinate while end of render for all objects.
//     //　　　..Possible to target this section: PREDEST, LAYER_PRE_FILTER
//     // 2. loop processing objects in layer (scheduleForTree)
//     // | 2-1. if object is vectorGroup,
//     // |      create new render target **VECTOR_GROUP_AGGREGATE_TARGET** and render child objects to it
//     // |    reason: If nested within a vectorGroup, using an existing buffer may overwrite
//     // |            the buffer used by the ancestor render process.
//     // |    TODO: There is a possibility to Direct Output to the parent renderTarget,
//     // |          but I don't think it has been implemented yet.
//     // |    TODO: If vectorGroup not has nested vectorGroup and normal composite mode,
//     // |          may be able to Direct Output to CONTAIENR_GROUP_RENDER_TARGET.
//     // |    ..Possible to target this section,  VECTOR_GROUP_AGGREGATE_TARGET (next CONTAIENR_GROUP_RENDER_TARGET)
//     // |     2-1-2. Dest to **VECTOR_OBJECT_PRE_FILTER** from VECTOR_GROUP_AGGREGATE_TARGET
//     // |            on finish to render child objects
//     // | 2-2. if object is vectorObject,
//     // |     2-2-1. Dest to **CONTAIENR_GROUP_RENDER_TARGET**, if object only has internal filter
//     // |     2-2-２-1. Dest to **VECTOR_OBJECT_PRE_FILTER**, if object has external filter,
//     // |               Render internal filter and external filter to it.
//     // |               And using **SHARED_FILTER_BUF** as swap buffer for extenal filter processing.
//     // |               (VECTOR_OBJECT_PRE_FILTER <-> SHARED_FILTER_BUF)
//     // |         Last result should be render into VECTOR_OBJECT_PRE_FILTER.
//     // |     2-2-2-2. copy to **LAYER_PRE_FILTER** result of VECTOR_OBJECT_PRE_FILTER
//     // |     2-2-2-3. clear VECTOR_OBJECT_PRE_FILTER
//     // | 2-3. CLEAR SHARED_FILTER_BUF
//     // └ 2-4. apply group filters on VECTOR_OBJECT_PRE_FILTER <-> SHARED_FILTER_BUF
//     //   2-5. draw VECTOR_OBJECT_PRE_FILTER to LAYER_PRE_FILTER with composite mode and opacity

//     let canLayerDirectOutput = vis.blendMode === 'normal' && !hasLayerFilter

//     const vectorLayerOut = hasLayerFilter
//       ? RenderTargets.LAYER_PRE_FILTER
//       : RenderTargets.PREDEST

//     for (const object of vis.objects) {
//       scheduleForTree(vectorLayerOut, object, canLayerDirectOutput)
//     }

//     tasks.push({
//       command: RenderCommands.DRAW_SOURCE_TO_DEST,
//       source: vectorLayerOut,
//       renderTarget: canLayerDirectOutput
//         ? RenderTargets.PREDEST
//         : RenderTargets.LAYER_PRE_FILTER,
//       blendMode: vis.blendMode,
//       opacity: 1,
//       _debug: ['vector layer tail'],
//     })

//     // #region scheduleForTree
//     function scheduleForTree(
//       CONTAIENR_GROUP_RENDER_TARGET: RenderTargets,
//       object: VectorObject | VectorGroup,
//       isParentUseDirectOutput: boolean = true,
//     ) {
//       if (!object.visible) return

//       const objHasExternalFilter = object.filters.some((f) => {
//         return f.kind === 'external' && f.enabled
//       })

//       const canObjDirectOutput =
//         isParentUseDirectOutput &&
//         object.blendMode === 'normal' &&
//         !objHasExternalFilter

//       const CURRENT_VECTOR_GROUP_AGGREGATE_TARGET = NEW_CANVAS_TARGET(
//         `nodeedge ${object.uid}`,
//       )

//       if (object.type === 'vectorGroup') {
//         scheduleForTree(
//           canObjDirectOutput
//             ? CONTAIENR_GROUP_RENDER_TARGET
//             : CURRENT_VECTOR_GROUP_AGGREGATE_TARGET,
//           object,
//           canObjDirectOutput,
//         )

//         if (!canObjDirectOutput) {
//           // if not direct output, draw aggregated result to CONTAIENR_GROUP_RENDER_TARGET
//           tasks.push(
//             {
//               command: RenderCommands.DRAW_SOURCE_TO_DEST,
//               source: CURRENT_VECTOR_GROUP_AGGREGATE_TARGET,
//               renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
//               blendMode: object.blendMode,
//               opacity: object.opacity,
//               _debug: [
//                 'scheduleForTree',
//                 'vectorGroup',
//                 'disableDirectOutput',
//               ],
//             },
//             {
//               command: RenderCommands.FREE_TARGET,
//               source: RenderTargets.NONE,
//               renderTarget: CURRENT_VECTOR_GROUP_AGGREGATE_TARGET,
//               _debug: [
//                 'scheduleForTree',
//                 'vectorGroup',
//                 'disableDirectOutput',
//               ],
//             },
//           )
//         }
//       }

//       // Clear before using external filter
//       if (objHasExternalFilter) {
//         tasks.push({
//           command: RenderCommands.CLEAR_TARGET,
//           source: RenderTargets.NONE,
//           renderTarget: RenderTargets.SHARED_FILTER_BUF,
//           _debug: [
//             'scheduleForTree',
//             'anyObject',
//             'objHasExternalFilter',
//             'prefiltering-internal-external',
//           ],
//         })
//       }

//       // Processing internal & external object filters
//       for (const filter of object.filters) {
//         if (!filter.enabled) continue

//         if (filter.kind !== 'external') {
//           // internal filters
//           tasks.push({
//             command: RenderCommands.APPLY_INTERNAL_OBJECT_FILTER,
//             source: RenderTargets.NONE,
//             renderTarget: canObjDirectOutput
//               ? RenderTargets.PREDEST
//               : RenderTargets.VECTOR_OBJECT_PRE_FILTER,
//             layerUid: child.uid,
//             object,
//             filter,
//             _debug: ['scheduleForTree', 'internalFilterProceed'],
//           })
//         } else {
//           // render external filters

//           if (filter.processor.opacity <= 0) continue
//           if (canObjDirectOutput) {
//             throw new PaplicoError(
//               `Invioation of external filter on object ${object.uid} is not allowed in direct output `,
//             )
//           }

//           tasks.push(
//             {
//               command: RenderCommands.APPLY_EXTERNAL_OBJECT_FILTER,
//               source: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
//               renderTarget: RenderTargets.SHARED_FILTER_BUF,
//               layerUid: child.uid,
//               objectUid: object.uid,
//               filter,
//               _debug: ['scheduleForTree', 'anyObject', 'externalFilter'],
//             },
//             {
//               command: RenderCommands.DRAW_SOURCE_TO_DEST,
//               source: RenderTargets.SHARED_FILTER_BUF,
//               renderTarget: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
//               blendMode: 'normal',
//               opacity: filter.processor.opacity,
//               _debug: ['scheduleForTree', 'anyObject', 'externalFilter'],
//             },
//           )
//         }
//       }

//       if (!canObjDirectOutput) {
//         tasks.push({
//           command: RenderCommands.DRAW_SOURCE_TO_DEST,
//           source: RenderTargets.VECTOR_OBJECT_PRE_FILTER,
//           renderTarget: RenderTargets.LAYER_PRE_FILTER,
//           blendMode: object.blendMode,
//           opacity: object.opacity,
//           _debug: ['scheduleForTree', 'anyObject', '!canObjDirectOutput'],
//         })
//       }
//     }
//     // #endregion
//   } else if (vis.type === 'text') {
//     if (vis.textNodes.length === 0) continue

//     tasks.push({
//       command: RenderCommands.DRAW_SOURCE_TO_DEST,
//       source: { visually: vis },
//       renderTarget: hasLayerFilter
//         ? RenderTargets.LAYER_PRE_FILTER
//         : RenderTargets.PREDEST,
//       blendMode: vis.blendMode,
//       opacity: vis.opacity,
//     })
//   } else if (vis.type === 'reference') {
//     const referencedLayer = preResolvedLayers.get(vis.uid)
//     if (!referencedLayer) continue

//     tasks.push({
//       command: RenderCommands.DRAW_SOURCE_TO_DEST,
//       source: { visually: referencedLayer },
//       renderTarget: hasLayerFilter
//         ? RenderTargets.LAYER_PRE_FILTER
//         : RenderTargets.PREDEST,
//       blendMode: vis.blendMode,
//       opacity: vis.opacity,
//     })
//   }

//   // Apply layer filters
//   if (hasLayerFilter) {
//     for (const layerFilter of vis.filters) {
//       if (!layerFilter.enabled) continue

//       tasks.push(
//         {
//           command: RenderCommands.CLEAR_TARGET,
//           source: RenderTargets.NONE,
//           renderTarget: RenderTargets.SHARED_FILTER_BUF,
//         },
//         {
//           command: RenderCommands.APPLY_LAYER_FILTER,
//           source: RenderTargets.LAYER_PRE_FILTER,
//           renderTarget: RenderTargets.SHARED_FILTER_BUF,
//           filter: layerFilter,
//         },
//         {
//           command: RenderCommands.CLEAR_TARGET,
//           source: RenderTargets.NONE,
//           renderTarget: RenderTargets.LAYER_PRE_FILTER,
//         },
//         {
//           command: RenderCommands.DRAW_SOURCE_TO_DEST,
//           source: RenderTargets.SHARED_FILTER_BUF,
//           renderTarget: RenderTargets.LAYER_PRE_FILTER,
//           blendMode: 'normal',
//           opacity: 1,
//         },
//       )
//     }

//     tasks.push(
//       {
//         command: RenderCommands.DRAW_SOURCE_TO_DEST,
//         source: RenderTargets.LAYER_PRE_FILTER,
//         renderTarget: RenderTargets.PREDEST,
//         blendMode: vis.blendMode,
//         opacity: vis.opacity,
//       },
//       {
//         command: RenderCommands.CLEAR_TARGET,
//         source: RenderTargets.NONE,
//         renderTarget: RenderTargets.SHARED_FILTER_BUF,
//       },
//     )
//   }
// }

// if (process.env.NODE_ENV === 'test') {
//   tasks.forEach((t, i) => {
//     tasks[i] = Object.assign({ i }, t)
//   })
// }

// // let cacheLimit = 5
// // let cacheScheduledTasks = []
// // let cachingLayerUids = new Set<string>()

// // for (const task of tasks) {
// //   if (task.command === RenderCommands.DRAW_SOURCE_TO_DEST) {
// //     if (
// //       task.meta?.vectorCanNotLayerDirectOutput &&
// //       task.renderTarget === RenderTargets.PREDEST
// //     ) {
// //       cacheScheduledTasks.push(task)
// //       cachingLayerUids.add(task.source.layer.uid)
// //     }
// //   } else if (task.command === RenderCommands.CLEAR_TARGET) {
// //     if (cachingLayerUids.has(task.renderTarget.layerUid)) {
// //       cacheScheduledTasks.push(task)
// //     }
// //   }
// // }

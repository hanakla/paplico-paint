import { useEditorStore, useEngineStore } from '@/store'
import { memo, useCallback, useEffect, useMemo, useReducer } from 'react'
import { RectReadOnly } from 'react-use-measure'
import { storePicker } from '@/utils/zustand'
import { ShapeTools } from './VectorEditor/ShapeTools'
import { VisuElement } from './VectorEditor/VisuElement'
import { Document } from '@paplico/core-new'
import { useMemoRevailidatable } from '@/utils/hooks'
import { DisplayedResolvedNode } from '@/stores/editor'

type Props = {
  width: number
  height: number
  rootBBox: RectReadOnly
}

export const VectorEditor = memo(function VectorEditor({
  width,
  height,
}: Props) {
  const { paplico } = useEngineStore(storePicker(['paplico']))
  const editorStore = useEditorStore(
    storePicker([
      'toolMode',
      'setSelectedVisuUids',
      'displayedResolvedNodes',
      'setDisplayResolvedNodes',
    ]),
  )
  const rerender = useReducer((x) => x + 1, 0)[1]
  const strokingTarget = paplico.getStrokingTarget()

  const handleClickRoot = useCallback(() => {
    editorStore.setSelectedVisuUids(() => ({}))
  }, [])

  useEffect(() => {
    return paplico.on('history:affect', ({ layerIds }) => {
      rerender()
    })
  })

  const [displayedVisues, revalidateDisplayedVisues] =
    useMemoRevailidatable(() => {
      if (!strokingTarget) return []

      // If group node of directly under the root,
      // Paplico considers that the user did not make it in them
      // own right, and retrieves up to two nodes below the root.
      const startNode =
        strokingTarget.nodePath.length === 1 ? [] : strokingTarget.nodePath
      const node =
        paplico.currentDocument?.layerNodes.getResolvedLayerNodes(startNode)
      const maxDepth = strokingTarget.nodePath.length === 1 ? 2 : 1

      if (!node) return []

      const flatten = (function flattenNodes(
        parent: Document.PaplicoDocument.ResolvedLayerNode,
        depth: number,
        parentVisibirity: boolean,
        parentLocked: boolean,
      ): DisplayedResolvedNode[] {
        if (depth > maxDepth) return []

        return parent.children.reduce((accum, node) => {
          accum.push({
            ...node,
            visible: parentVisibirity && node.visu.visible,
            locked: parentLocked || node.visu.lock,
          } satisfies DisplayedResolvedNode)

          return [
            ...accum,
            ...flattenNodes(
              node,
              depth + 1,
              parentVisibirity && node.visu.visible,
              parentLocked || node.visu.lock,
            ),
          ]
        }, [] as DisplayedResolvedNode[])
      })(node, 0, node.visu.visible, node.visu.lock)

      return flatten
    }, [strokingTarget?.nodePath])

  useEffect(() => {
    editorStore.setDisplayResolvedNodes(displayedVisues)
  }, [displayedVisues])

  useEffect(() => {
    return paplico.on('finishRenderCompleted', () => {
      revalidateDisplayedVisues()
    })
  }, [])

  if (strokingTarget?.visuType === 'canvas') return

  return (
    <svg
      data-pplc-component="VectorEditor"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        fill: 'none',
        outline: 'none',
        pointerEvents: 'none',
      }}
      tabIndex={-1}
    >
      {/* Layer outline */}
      {/* <rect
        width={width}
        height={height}
        x={0}
        y={0}
        onClick={handleClickRoot}
        stroke="#0ff"
        strokeWidth={2}
        style={{
          pointerEvents: 'stroke',
        }}
      /> */}

      <text x={20} y={20} fill="red" fontWeight="bold" fontSize={24}>
        CurrentTool: {editorStore.toolMode}
      </text>

      {editorStore.displayedResolvedNodes.map((node) => (
        <VisuElement
          key={node.uid}
          visu={node.visu}
          layerNodePath={node.path}
          visible={node.visible}
          locked={node.locked}
        />
      ))}

      <ShapeTools width={width} height={height} />
    </svg>
  )
})

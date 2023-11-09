import { useEditorStore, useEngineStore } from '@/store'
import { memo, useCallback, useEffect, useMemo, useReducer } from 'react'
import { VectorObjectElement } from './VectorEditor/VisuElement.VectorObject'
import { RectReadOnly } from 'react-use-measure'
import { storePicker } from '@/utils/zustand'
import { ShapeTools } from './VectorEditor/ShapeTools'
import { isVectorShapeToolMode } from '@/stores/editor'
import { VisuElement } from './VectorEditor/VisuElement'
import { Document } from '@paplico/core-new'
import { useMemoRevailidatable } from '@/utils/hooks'

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
  const editorStore = useEditorStore()
  const rerender = useReducer((x) => x + 1, 0)[1]

  const strokingTarget = paplico.getStrokingTarget()

  const strokingTargetLayerNode = useMemo(() => {
    if (!strokingTarget) return null
    return paplico.currentDocument?.layerNodes.getResolvedLayerNodes(
      strokingTarget.nodePath,
    )
  }, [strokingTarget?.visuUid])

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

      const node = paplico.currentDocument?.layerNodes.getResolvedLayerNodes(
        strokingTarget.nodePath,
      )

      if (!node) return []

      const flatten = (function flattenNodes(
        parent: Document.PaplicoDocument.ResolvedLayerNode,
        depth: number,
      ): Document.PaplicoDocument.ResolvedLayerNode[] {
        if (depth > 1) return []

        return parent.children.reduce((accum, node) => {
          accum.push(node)
          return [...accum, ...flattenNodes(node, depth + 1)]
        }, [] as Document.PaplicoDocument.ResolvedLayerNode[])
      })(node, 0)

      return flatten
    }, [strokingTarget?.nodePath])

  useEffect(() => {
    return paplico.on('finishRenderCompleted', () => {
      revalidateDisplayedVisues()
    })
  }, [])

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
      <rect
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
      />

      <text x={20} y={20} fill="red" fontWeight="bold" fontSize={24}>
        CurrntZool:: {editorStore.toolMode}
      </text>

      {isVectorShapeToolMode(editorStore.toolMode) && (
        <ShapeTools width={width} height={height} />
      )}

      {displayedVisues.map((node) => (
        <VisuElement
          key={node.uid}
          visu={node.visu}
          layerNodePath={node.path}
        />
      ))}
    </svg>
  )
})

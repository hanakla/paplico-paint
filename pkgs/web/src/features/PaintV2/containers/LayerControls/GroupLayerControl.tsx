import { useStore } from '@fleur/react'
import { useRef } from 'react'
import { useDrag } from 'react-use-gesture'
import { PapCommands } from '@paplico/core'
import { EditorOps, EditorSelector } from '🙌/domains/EditorStable'
import { DOMUtils } from '🙌/utils/dom'
import { useFleur } from '🙌/utils/hooks'
import { useLayerWatch } from '../../hooks'

export const GroupLayerControl = () => {
  const { execute } = useFleur()

  const rootRef = useRef<SVGSVGElement | null>(null)

  const { activeLayer, activeLayerPath, currentDocument, currentTool } =
    useStore((get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      canvasScale: EditorSelector.canvasScale(get),
      currentDocument: EditorSelector.currentDocument(get),
      currentTool: EditorSelector.currentTool(get),
    }))

  const bbox = currentDocument?.getLayerSize(activeLayer!) ?? null

  const bindDrag = useDrag(({ initial, xy }) => {
    if (currentTool !== 'cursor' || !activeLayerPath) return

    const initP = DOMUtils.domPointToSvgPoint(rootRef.current!, {
      x: initial[0],
      y: initial[1],
    })
    const point = DOMUtils.domPointToSvgPoint(rootRef.current!, {
      x: xy[0],
      y: xy[1],
    })

    execute(
      EditorOps.runCommand,
      new PapCommands.Layer.PatchLayerAttr({
        pathToTargetLayer: activeLayerPath,
        patch: {
          x: point.x - initP.x,
          y: point.y - initP.y,
        },
      })
    )
  })

  useLayerWatch(activeLayer)

  if (activeLayer?.layerType !== 'group' || !bbox || !currentDocument)
    return null

  return (
    <svg
      ref={rootRef}
      data-devmemo="Group layer control"
      width={currentDocument.width}
      height={currentDocument.height}
      viewBox={`0 0 ${currentDocument.width} ${currentDocument.height}`}
      overflow="visible"
    >
      {currentTool === 'cursor' && (
        <rect
          css={`
            fill: transparent;
            stroke: #0ff;
            stroke-width: 3px;
            pointer-events: visiblePainted;
          `}
          x={activeLayer.x}
          y={activeLayer.y}
          width={bbox?.width}
          height={bbox?.height}
          {...bindDrag()}
        />
      )}
    </svg>
  )
}

import { useStore } from '@fleur/react'
import { useRef, useMemo } from 'react'
import { useDrag } from 'react-use-gesture'
import { PapCommands, PapDOMDigger } from '@paplico/core'
import { EditorOps, EditorSelector } from '🙌/domains/EditorStable'
import { DOMUtils } from '🙌/utils/dom'
import { useFleur } from '🙌/utils/hooks'
import { useLayerWatch, useTransactionCommand } from '../../hooks'

export const ReferenceLayerControl = () => {
  const { execute } = useFleur()

  const {
    activeLayer,
    activeLayerPath,
    canvasScale,
    currentDocument,
    currentTool,
  } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    activeLayerPath: EditorSelector.activeLayerPath(get),
    canvasScale: EditorSelector.canvasScale(get),
    currentDocument: EditorSelector.currentDocument(get),
    currentTool: EditorSelector.currentTool(get),
  }))

  const rootRef = useRef<SVGSVGElement | null>(null)

  const trnsCommand = useTransactionCommand()

  const bindDrag = useDrag(({ initial, xy, delta, last }) => {
    if (currentTool !== 'cursor' || !activeLayer || !activeLayerPath) return

    // const initP = DOMUtils.domPointToSvgPoint(rootRef.current!, {
    //   x: initial[0],
    //   y: initial[1],
    // })

    // const point = DOMUtils.domPointToSvgPoint(rootRef.current!, {
    //   x: xy[0],
    //   y: xy[1],
    // })

    trnsCommand.autoStartAndDoAdd(
      new PapCommands.Layer.PatchLayerAttr({
        pathToTargetLayer: activeLayerPath,
        patch: {
          x: activeLayer.x + delta[0] * (1 / canvasScale),
          y: activeLayer.y + delta[1] * (1 / canvasScale),
        },
      })
    )

    if (last) {
      trnsCommand.commit()
    }
  })

  const realLayer = useMemo(() => {
    return PapDOMDigger.findLayerRecursive(currentDocument!, activeLayer!.uid)
  }, [currentDocument?.uid, activeLayer?.uid])

  const bbox = realLayer ? currentDocument?.getLayerSize(realLayer) : null

  useLayerWatch(activeLayer)

  if (activeLayer?.layerType !== 'reference' || !bbox || !currentDocument)
    return null

  return (
    <svg
      ref={rootRef}
      data-devmemo="Raster layer control"
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

import { useEditorStore, useEngineStore } from '@/store'
import { ToolModes } from '@/stores/types'
import { useMemoRevailidatable, usePointerDrag } from '@/utils/hooks'
import {
  Commands,
  Document,
  PaplicoMath,
  SVGPathManipul,
} from '@paplico/core-new'
import { VisuElement as VisuElementType } from '@paplico/core-new/dist/Document'
import {
  KeyboardEvent,
  ReactNode,
  SVGProps,
  memo,
  useCallback,
  useEffect,
  useReducer,
  useState,
} from 'react'
import { unstable_batchedUpdates } from 'react-dom'
import { createUseStyles } from 'react-jss'
import useEvent from 'react-use-event-hook'
import { VectorObjectElement } from './VisuElement.VectorObject'
import { usePropsMemo } from '@paplico/shared-lib'

const RECT_SIZE = 10
const HALF_OF_RECT_SIZE = RECT_SIZE / 2

export const VisuElement = memo(function VisuElement({
  visu,
  layerNodePath,
  children,
}: {
  visu:
    | VisuElementType.FilterElement
    | VisuElementType.GroupElement
    | VisuElementType.CanvasElement
    | VisuElementType.ImageReferenceElement
    | VisuElementType.TextElement
    | VisuElementType.VectorObjectElement
  layerNodePath: string[]
  children?: ReactNode
}) {
  const editor = useEditorStore()

  const { paplico } = useEngineStore()
  const s = usePathStyle()
  const propsMemo = usePropsMemo()
  const rerender = useReducer((s) => s + 1, 0)[1]

  const elementScale = 1 / editor.canvasScale

  const [transformOverride, setTransfromOverride] = useState<{
    x: number
    y: number
  } | null>(null)

  const bindDrag = usePointerDrag(
    async ({ movement, offsetMovement, last, event }) => {
      if (editor.toolMode !== ToolModes.objectTool) return
      if (PaplicoMath.distance2D(0, 0, movement[0], movement[1]) < 4) return

      if (!last) {
        setTransfromOverride({
          x: offsetMovement[0] / elementScale,
          y: offsetMovement[1] / elementScale,
        })

        paplico.requestPreviewPriolityRerender({
          transformOverrides: {
            [visu.uid]: (base) => {
              base.transform.position.x += offsetMovement[0] / elementScale
              base.transform.position.y += offsetMovement[1] / elementScale
              return base
            },
          },
        })
      } else {
        await paplico.command.do(
          new Commands.VisuUpdateAttributes(visu.uid, {
            updater: (target) => {
              target.transform.position = {
                x:
                  target.transform.position.x +
                  offsetMovement[0] / elementScale,
                y:
                  target.transform.position.y +
                  offsetMovement[1] / elementScale,
              }
            },
          }),
        )

        setTransfromOverride(null)
      }
    },
  )

  const handleKeyDown = useEvent((e: KeyboardEvent<SVGElement>) => {
    if (editor.toolMode !== ToolModes.objectTool) return

    if (e.key === 'Delete') {
      paplico.command.do(
        new Commands.DocumentManipulateLayerNodes({
          remove: [layerNodePath],
        }),
      )
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const amount = (e.key === 'ArrowUp' ? -1 : 1) * (e.shiftKey ? 10 : 1)

      paplico.command.do(
        new Commands.VisuUpdateAttributes(visu.uid, {
          updater: (target) => {
            target.transform.position.y += amount
          },
        }),
      )
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const amount = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1)

      paplico.command.do(
        new Commands.VisuUpdateAttributes(visu.uid, {
          updater: (target) => {
            target.transform.position.x += amount
          },
        }),
      )
    }
  })

  useEffect(() => {
    const offs = [
      paplico.on('document:layerUpdated', ({ layerEntityUid }) => {
        if (layerEntityUid !== visu.uid) return

        unstable_batchedUpdates(() => {
          // revalidatePathElement()
          // revalidateDetailElements()
        })
      }),
      paplico.on('document:metrics:update', ({ updatedVisuUids }) => {
        if (updatedVisuUids.includes(visu.uid)) rerender()
      }),
    ]

    return () => {
      offs.forEach((off) => off())
    }
  })

  const elements = (() => {
    const metrics = paplico.visuMetrics?.getLayerMetrics(visu.uid)
    if (!metrics) return null

    const left = metrics.originalBBox.left + (transformOverride?.x ?? 0)
    const top = metrics.originalBBox.top + (transformOverride?.y ?? 0)
    const right = metrics.originalBBox.right + (transformOverride?.x ?? 0)
    const bottom = metrics.originalBBox.bottom + (transformOverride?.y ?? 0)

    return [
      <rect
        key="bbox"
        className={s.bbox}
        x={left}
        y={top}
        width={metrics.originalBBox.width}
        height={metrics.originalBBox.height}
        {...bindDrag()}
      />,
      <rect
        key="left-top"
        className={s.controlPoint}
        x={left - HALF_OF_RECT_SIZE}
        y={top - HALF_OF_RECT_SIZE}
        width={RECT_SIZE}
        height={RECT_SIZE}
      />,
      <rect
        key="right-top"
        className={s.controlPoint}
        x={right - HALF_OF_RECT_SIZE}
        y={top - HALF_OF_RECT_SIZE}
        width={RECT_SIZE}
        height={RECT_SIZE}
      />,
      <rect
        key={30}
        className={s.controlPoint}
        x={right - HALF_OF_RECT_SIZE}
        y={bottom - HALF_OF_RECT_SIZE}
        width={RECT_SIZE}
        height={RECT_SIZE}
      />,
      <rect
        key="left-bottom"
        className={s.controlPoint}
        x={left - HALF_OF_RECT_SIZE}
        y={bottom - HALF_OF_RECT_SIZE}
        width={RECT_SIZE}
        height={RECT_SIZE}
      />,
    ]
  })()

  // const [bboxPath, revalidatePathElement] = useMemoRevailidatable(() => {
  //   const d = SVGPathManipul.vectorPathPointsToSVGPath(visu.path.points)

  //   return (
  //     <>
  //       <MemoPath
  //         stroke="transparent"
  //         d={d}
  //         strokeWidth={3 * elementScale}
  //         onClick={onClickPath}
  //         className={s.previewStroke}
  //         style={{ cursor: 'pointer', touchAction: 'none' }}
  //         {...bindDrag()}
  //       />
  //     </>
  //   )
  // }, [/* FIXME: */ visu.path, onClickPath])

  return (
    <g
      data-pplc-component="VisuElement"
      data-pplc-visu-uid={visu.uid}
      style={{
        pointerEvents: editor.selectedVisuUids[visu.uid] ? 'painted' : 'stroke',
        transform: `translate(${visu.transform.position.x}px, ${visu.transform.position.y}px)`,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={s.root}
      data-editable-tooled={
        editor.toolMode === ToolModes.objectTool ||
        editor.toolMode === ToolModes.pointTool
      }
    >
      {elements}
      <g>
        {visu.type === 'vectorObject' && (
          <VectorObjectElement visuUid={visu.uid} visu={visu} />
        )}
      </g>
    </g>
  )
})

const usePathStyle = createUseStyles({
  root: {
    outline: 'none',
  },
  bbox: {
    stroke: 'none',
    fill: 'none',
    pointerEvents: 'painted',
    '&:where([data-editable-tooled="true"] > *)': {
      fill: 'transparent',
      strokeWidth: 2,
      stroke: 'var(--pap-stroke-color)',
    },
    // '&:hover': {
    //   cursor: 'move',
    //   stroke: 'var(--pap-stroke-color)',
    // },
  },
  controlPoint: {
    display: 'none',
    fill: 'white',
    stroke: 'var(--pap-stroke-color)',
    strokeWidth: 1.5,
    paintOrder: 'fill stroke',
    '&:where([data-editable-tooled="true"] > *)': {
      display: 'inline',
    },
  },
})

const MemoPath = memo(function MemoPath(props: SVGProps<SVGPathElement>) {
  return <path {...props} />
})

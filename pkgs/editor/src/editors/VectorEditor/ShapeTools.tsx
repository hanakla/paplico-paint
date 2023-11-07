import { useEditorStore, useEngineStore } from '@/store'
import { usePointerDrag } from '@/utils/hooks'
import {
  flipRectOriginFromLeftTop,
  getSidingByMovement as getSideDirectionByMovement,
  reveseSiding,
} from '@/utils/math'
import { VectorToolModes } from '@/stores/types'
import { storePicker } from '@/utils/zustand'
import { Commands, Document } from '@paplico/core-new'

import { memo, useState } from 'react'
import { createUseStyles } from 'react-jss'
import useMeasure from 'react-use-measure'

type Props = {
  width: number
  height: number
}

export const ShapeTools = memo(function ShapeTools({ width, height }: Props) {
  const { paplico } = useEngineStore()
  const editor = useEditorStore(
    storePicker(['vectorToolMode', 'strokingTarget']),
  )
  const s = useStyles()

  const [measureRef, rootRect] = useMeasure()

  const [rect, setRectPreview] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const [circle, setCirclePreview] = useState<{
    cx: number
    cy: number
    rx: number
    ry: number
  } | null>(null)

  const bindRectDrag = usePointerDrag(
    ({ offsetInitial, offsetMovement, last, event, canceled }) => {
      if (!editor.strokingTarget?.visuUid) return

      // rectangle tool
      if (editor.vectorToolMode === VectorToolModes.rectangleTool) {
        const cursorSide = reveseSiding(
          getSideDirectionByMovement(offsetMovement),
        )

        let width = Math.abs(offsetMovement[0]),
          height = Math.abs(offsetMovement[1])

        if (event.shiftKey) {
          width = height = Math.min(width, height)
        }

        const rect = flipRectOriginFromLeftTop(
          cursorSide,
          offsetInitial[0],
          offsetInitial[1],
          width,
          height,
        )

        if (last) {
          const stroke = paplico.cloneBrushSetting()
          const fill = paplico.cloneFillSetting()
          const ink = paplico.cloneInkSetting()

          paplico.command.do(
            new Commands.DocumentManipulateLayerNodes({
              add: [
                {
                  visu: Document.visu.createVectorObjectVisually({
                    path: createRectPathByRect(
                      rect.x,
                      rect.y,
                      rect.width,
                      rect.height,
                    ),
                    filters: [
                      stroke
                        ? Document.visu.createVisuallyFilter('stroke', {
                            stroke,
                            ink: ink,
                          })
                        : undefined,
                      fill
                        ? Document.visu.createVisuallyFilter('fill', {
                            fill: fill,
                          })
                        : undefined,
                    ].filter((v): v is NonNullable<typeof v> => v != null),
                  }),
                  parentNodePath: editor.strokingTarget?.nodePath,
                  indexInNode: -1,
                },
              ],
            }),
          )

          setRectPreview(null)
          return
        }

        setRectPreview(rect)
      } else if (editor.vectorToolMode === VectorToolModes.ellipseTool) {
        const cursorSide = reveseSiding(
          getSideDirectionByMovement(offsetMovement),
        )

        let rx = Math.abs(offsetMovement[0] / 2),
          ry = Math.abs(offsetMovement[1] / 2)

        if (event.shiftKey) {
          const min = Math.min(rx, ry)
          ry = rx = min
        }

        const rect = flipRectOriginFromLeftTop(
          cursorSide,
          offsetInitial[0],
          offsetInitial[1],
          rx * 2,
          ry * 2,
        )

        const cx = rect.x + rect.width / 2,
          cy = rect.y + rect.height / 2

        if (last) {
          const stroke = paplico.cloneBrushSetting()
          const fill = paplico.cloneFillSetting()
          const ink = paplico.cloneInkSetting()

          paplico.command.do(
            new Commands.DocumentManipulateLayerNodes({
              add: [
                {
                  visu: Document.visu.createVectorObjectVisually({
                    path: createCirclePathByRect(
                      rect.x,
                      rect.y,
                      rect.width,
                      rect.height,
                    ),
                    filters: [
                      stroke
                        ? Document.visu.createVisuallyFilter('stroke', {
                            stroke,
                            ink: ink,
                          })
                        : undefined,
                      fill
                        ? Document.visu.createVisuallyFilter('fill', {
                            fill: fill,
                          })
                        : undefined,
                    ].filter((v): v is NonNullable<typeof v> => v != null),
                  }),
                  parentNodePath: editor.strokingTarget.nodePath,
                  indexInNode: -1,
                },
              ],
            }),
          )

          setCirclePreview(null)
          return
        }

        setCirclePreview({
          cx,
          cy,
          rx,
          ry,
        })
      }
    },
  )

  return (
    <>
      {/* Rect tool handler */}
      <g>
        <rect
          ref={measureRef}
          width={width}
          height={height}
          x={0}
          y={0}
          fill="transparent"
          stroke="none"
          style={{
            pointerEvents: 'all',
          }}
          {...bindRectDrag()}
        />

        {rect && (
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill="transparent"
            strokeWidth={1}
            className={s.feedbackElement}
          />
        )}

        {circle && (
          <>
            <rect
              x={circle.cx - circle.rx}
              y={circle.cy - circle.ry}
              width={circle.rx * 2}
              height={circle.ry * 2}
              fill="transparent"
              strokeWidth={0.5}
              className={s.feedbackElement}
            />
            <ellipse
              cx={circle.cx}
              cy={circle.cy}
              rx={circle.rx}
              ry={circle.ry}
              fill="transparent"
              strokeWidth={1}
              className={s.feedbackElement}
            />
          </>
        )}
      </g>
    </>
  )
})

const useStyles = createUseStyles({
  feedbackElement: {
    pointerEvents: 'none',
    stroke: 'var(--pap-ui-color)',
  },
})

function createRectPathByRect(
  x: number,
  y: number,
  width: number,
  height: number,
): Document.VisuElement.VectorPath {
  return Document.visu.createVectorPath({
    points: [
      { isMoveTo: true, x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x: x, y: y + height },
      { x, y },
      { isClose: true, x: 0, y: 0 },
    ],
  })
}

// Author: ChatGPT
function createCirclePathByRect(
  x: number,
  y: number,
  width: number,
  height: number,
): Document.VisuElement.VectorPath {
  const rx = width / 2
  const ry = height / 2
  const hrx = rx / 2
  const hry = ry / 2
  const cx = x + rx
  const cy = y + ry

  const right = x + width
  const bottom = y + height

  // Define the path data using Cubic Bezier curves to approximate the ellipse
  return Document.visu.createVectorPath({
    // prettier-ignore
    points:[
      {isMoveTo: true, x: cx, y: y},
      { x: right, y: y + ry, begin: { x: cx + hrx, y: y }, end: { x: right, y: cy - hry } },
      { x: cx, y: bottom, begin: { x: right, y: cy + hry }, end: { x: cx + hrx, y: bottom } },
      { x: x, y: cy, begin: { x: cx - hrx, y: bottom, }, end: { x: x, y: cy + hry} },
      { x: cx, y: y, begin: { x: x, y: cy - hry}, end: { x: cx - hrx, y: y}},
      { isClose: true, x: 0, y: 0 },
    ],
  })
}

import { useEditorStore, useEngineStore } from '@/store'
import { isShapeToolMode } from '@/stores/editor'
import { usePointerDrag } from '@/utils/hooks'
import {
  flipRectOriginFromLeftTop,
  getSidingByMovement as getSideDirectionByMovement,
  getSidingByTwoPoints,
  reveseSiding,
} from '@/utils/math'
import { ToolModes } from '@/utils/types'
import { storePicker } from '@/utils/zutrand'
import { Commands, Document } from '@paplico/core-new'

import { memo, useState } from 'react'
import { createUseStyles } from 'react-jss'
import useMeasure from 'react-use-measure'

type Props = {
  width: number
  height: number
}

export const ShapeTools = memo(function ShapeTools({ width, height }: Props) {
  const { paplico, activeLayer } = useEngineStore((s) => ({
    paplico: s.paplico,
    activeLayer: s.paplico.activeLayer,
  }))
  const editorStore = useEditorStore(storePicker(['toolMode']))
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
      if (!activeLayer?.layerUid) return

      // rectangle tool
      if (editorStore.toolMode === ToolModes.rectangleTool) {
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
          const stroke = paplico.cloneStrokeSetting()
          const fill = paplico.cloneFillSetting()
          const ink = paplico.cloneInkSetting()

          paplico.command.do(
            new Commands.VectorUpdateObjects(activeLayer.layerUid, {
              updater: ({ objects }) => {
                objects.push(
                  Document.createVectorObject({
                    path: createRectPathByRect(
                      rect.x,
                      rect.y,
                      rect.width,
                      rect.height,
                    ),
                    filters: [
                      stroke
                        ? Document.createVectorAppearance({
                            kind: 'stroke',
                            stroke,
                            ink: ink,
                          })
                        : undefined,
                      fill
                        ? Document.createVectorAppearance({
                            kind: 'fill',
                            fill: fill,
                          })
                        : undefined,
                    ].filter((v): v is NonNullable<typeof v> => v != null),
                  }),
                )
              },
            }),
          )

          setRectPreview(null)
          return
        }

        setRectPreview(rect)
      } else if (editorStore.toolMode === ToolModes.ellipseTool) {
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
          const stroke = paplico.cloneStrokeSetting()
          const fill = paplico.cloneFillSetting()
          const ink = paplico.cloneInkSetting()

          paplico.command.do(
            new Commands.VectorUpdateObjects(activeLayer.layerUid, {
              updater: ({ objects }) => {
                objects.push(
                  Document.createVectorObject({
                    path: createCirclePathByRect(
                      rect.x,
                      rect.y,
                      rect.width,
                      rect.height,
                    ),
                    filters: [
                      stroke
                        ? Document.createVectorAppearance({
                            kind: 'stroke',
                            stroke,
                            ink: ink,
                          })
                        : undefined,
                      fill
                        ? Document.createVectorAppearance({
                            kind: 'fill',
                            fill: fill,
                          })
                        : undefined,
                    ].filter((v): v is NonNullable<typeof v> => v != null),
                  }),
                )
              },
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

  const bindEllipseDrag = usePointerDrag(
    ({ offsetInitial, offsetMovement, last, event, canceled }) => {
      if (!activeLayer?.layerUid) return

      // circle tool
      if (editorStore.toolMode === ToolModes.ellipseTool) {
        if (last) {
          const stroke = paplico.cloneStrokeSetting()
          const fill = paplico.cloneFillSetting()
          const ink = paplico.cloneInkSetting()

          const rect = {
            x: offsetInitial[0],
            y: offsetInitial[1],
            width: offsetMovement[0],
            height: offsetMovement[1],
          }

          paplico.command.do(
            new Commands.VectorUpdateObjects(activeLayer.layerUid, {
              updater: ({ objects }) => {
                objects.push(
                  Document.createVectorObject({
                    path: createCirclePathByRect(
                      rect.x,
                      rect.y,
                      rect.width,
                      rect.height,
                    ),
                    filters: [
                      stroke
                        ? Document.createVectorAppearance({
                            kind: 'stroke',
                            stroke,
                            ink: ink,
                          })
                        : undefined,
                      fill
                        ? Document.createVectorAppearance({
                            kind: 'fill',
                            fill: fill,
                          })
                        : undefined,
                    ].filter((v): v is NonNullable<typeof v> => v != null),
                  }),
                )
              },
            }),
          )
          return
        }

        setCirclePreview({
          cx: offsetInitial[0],
          cy: offsetInitial[1],
          r: Math.sqrt(
            Math.pow(offsetMovement[0] - offsetInitial[0], 2) +
              Math.pow(offsetMovement[1] - offsetInitial[1], 2),
          ),
        })
      }
    },
  )

  return (
    <>
      {/* Rect tool handler */}
      {isShapeToolMode(editorStore.toolMode) && (
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
      )}
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
): Document.VectorPath {
  return Document.createVectorPath({
    points: [
      { isMoveTo: true, x: x, y: y },
      { x: width, y: y },
      { x: width, y: height },
      { x: x, y: height },
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
): Document.VectorPath {
  const rx = width / 2
  const ry = height / 2
  const cx = x + rx
  const cy = y + ry

  const kappa = 0.552284749831 // approximation constant for circle

  // Calculate control points for the Bezier curves
  const offsetX = rx * kappa
  const offsetY = ry * kappa

  // Define the start and end points of the Bezier curves
  const x0 = x
  const y0 = cy
  const x1 = x + width
  const y1 = cy

  // Define the path data using Cubic Bezier curves to approximate the ellipse
  return Document.createVectorPath({
    // prettier-ignore
    points:[
      {isMoveTo: true, x: x0, y: y0},
      {x: cx, y: y, begin: {x: x0, y: y-offsetY}, end: {x: cx-offsetX, y: y}},
      {x: x1, y: y0, begin: {x: cx+offsetX, y: y}, end: {x: x1, y: y-offsetY}},
      {x: x1, y: y1, begin: {x: x1, y: y+offsetY}, end: {x: cx+offsetX, y: y1}},
      {x: cx, y: y1, begin: {x: cx-offsetX, y: y1}, end: {x: x0, y: y+offsetY}},
      {isClose: true, x: x0, y: y0},
    ],
  })

  // const d = [
  //   `M${x0},${y0}`,
  //   `C${x0},${y0 - offsetY} ${cx - offsetX},${top} ${cx},${top}`,
  //   `C${cx + offsetX},${top} ${x1},${y0 - offsetY} ${x1},${y0}`,
  //   `C${x1},${y0 + offsetY} ${cx + offsetX},${top + height} ${cx},${
  //     top + height
  //   }`,
  //   `C${cx - offsetX},${top + height} ${x0},${y0 + offsetY} ${x0},${y0}`,
  //   'Z', // Close the path
  // ].join(' ')

  // return d
}

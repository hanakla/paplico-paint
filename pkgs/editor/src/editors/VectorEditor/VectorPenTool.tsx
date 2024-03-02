import { useEditorStore, useEngineStore } from '@/store'
import { ToolModes } from '@/stores/types'
import { usePointerDrag } from '@/utils/hooks'
import { storePicker } from '@/utils/zustand'
import { Commands, Document, PaplicoMath } from '@paplico/core-new'
import { domOn } from '@paplico/shared-lib'
import { memo, useEffect, useRef, useState } from 'react'

type Props = {
  width: number
  height: number
}

type TmpPathPoint = {
  // pointIdx: number
  x: number
  y: number
  beginForNext: { x: number; y: number }
  endForPrev: { x: number; y: number } | null
}

export const VectorPenTool = memo(function VectorPenTool({
  width,
  height,
}: Props) {
  const editor = useEditorStore(
    storePicker([
      'toolMode',
      'selectedVisuUidMap',
      'canvasScale',
      'setSelectedVisuUids',
      'setSelectedPoints',
      'vectorPenLastPoint',
      'setVectorPenLastPoint',
    ]),
  )

  const { paplico } = useEngineStore()

  const pointStateRef = useRef<TmpPathPoint | null>(null)
  const elementScale = 1 / editor.canvasScale

  const [controlPoints, setControlPoints] = useState<{
    pt: { x: number; y: number }
    begin: { x: number; y: number }
    end: { x: number; y: number }
  } | null>(null)

  const bindDrag = usePointerDrag(
    async ({ offsetInitial, offsetMovement, first, last }) => {
      const lastPoint = editor.vectorPenLastPoint
      const isNewVisu = !lastPoint

      const targetVisu = lastPoint
        ? paplico.currentDocument!.getVisuByUid(lastPoint.visuUid)
        : paplico.createVectorObjectByCurrentSettings(
            Document.visu.createVectorPath({
              points: [],
              fillRule: 'nonzero',
            }),
          )

      if (targetVisu?.type !== 'vectorObject') return

      const oppositeSidePos = PaplicoMath.getPointWithAngleAndDistance({
        base: { x: offsetInitial[0], y: offsetInitial[1] },
        angle:
          PaplicoMath.getRadianTangent(
            offsetInitial[0],
            offsetInitial[1],
            offsetInitial[0] + offsetMovement[0],
            offsetInitial[1] + offsetMovement[1],
          ) + PaplicoMath.degToRad(180),
        distance: PaplicoMath.distance2D(
          offsetInitial[0],
          offsetInitial[1],
          offsetInitial[0] + offsetMovement[0],
          offsetInitial[1] + offsetMovement[1],
        ),
      })

      setControlPoints({
        pt: {
          x: offsetInitial[0],
          y: offsetInitial[1],
        },
        begin: {
          x: offsetInitial[0] + offsetMovement[0],
          y: offsetInitial[1] + offsetMovement[1],
        },
        end: {
          x: oppositeSidePos.x,
          y: oppositeSidePos.y,
        },
      })

      if (isNewVisu) {
        await paplico.command.do(
          new Commands.DocumentManipulateLayerNodes({
            add: [
              {
                visu: targetVisu,
                parentNodePath: paplico.getStrokingTarget()?.nodePath ?? [],
              },
            ],
          }),
        )

        editor.setVectorPenLastPoint({
          visuUid: targetVisu.uid,
          pointIdx: 0,
        })
      }

      if (first) {
        await paplico.command.do(
          new Commands.VectorVisuUpdateAttributes(targetVisu.uid, {
            updater: (target) => {
              // Add new point
              target.path.points.push({
                ...(isNewVisu ? { isMoveTo: true } : {}),
                x: offsetInitial[0],
                y: offsetInitial[1],
                begin: null,
                end: null,
              })
            },
          }),
        )

        editor.setSelectedVisuUids(() => ({
          [targetVisu.uid]: true,
        }))

        editor.setSelectedPoints(() => ({
          [targetVisu.uid]: { '0': true },
        }))

        editor.setVectorPenLastPoint({
          visuUid: targetVisu.uid,
          pointIdx: 0,
        })
      } else if (last) {
        const current = pointStateRef.current!

        await paplico.command.do(
          new Commands.VectorVisuUpdateAttributes(targetVisu.uid, {
            updater: (target) => {
              const lastpt = target.path.points.at(-1)!

              if (current) {
                lastpt.begin = {
                  ...current.beginForNext,
                }
              }
              lastpt.end = {
                x: oppositeSidePos.x,
                y: oppositeSidePos.y,
              }
            },
          }),
        )

        pointStateRef.current = {
          x: offsetInitial[0],
          y: offsetInitial[1],
          beginForNext: {
            x: offsetInitial[0] + offsetMovement[0],
            y: offsetInitial[1] + offsetMovement[1],
          },
          endForPrev: null,
        }
      } else {
        const pointState = pointStateRef.current

        paplico.requestPreviewPriolityRerender({
          transformOverrides: {
            [targetVisu.uid]: (base) => {
              if (base.type !== 'vectorObject') return base

              const pt = base.path.points.at(-1)
              console.log(pt, pointState)
              if (pointState) {
                pt!.begin = {
                  ...pointState.beginForNext,
                }
              }
              pt!.end = {
                x: oppositeSidePos.x,
                y: oppositeSidePos.y,
              }
              return base
            },
          },
        })

        // paplico.putVisuPreview(visu, {})
      }
    },
  )

  useEffect(() => {
    return domOn(window, 'keydown', (e) => {
      if (e.key === 'Escape') {
        // targetVisuRef.current = null
        console.log('keydown', e.key)
        pointStateRef.current = null
        editor.setSelectedPoints(() => ({}))
        editor.setSelectedVisuUids(() => ({}))
        editor.setVectorPenLastPoint(null)
      }
    })
  }, [])

  if (editor.toolMode !== ToolModes.vectorPenTool) return null

  return (
    <g data-pplc-component="ShapeTools">
      <rect
        width={width}
        height={height}
        x={0}
        y={0}
        fill="transparent"
        stroke="none"
        style={{
          pointerEvents: 'all',
        }}
        {...bindDrag()}
      />

      {controlPoints && (
        <>
          <line
            stroke="var(--pplc-stroke-color)"
            x1={controlPoints.pt.x}
            y1={controlPoints.pt.y}
            x2={controlPoints.begin.x}
            y2={controlPoints.begin.y}
          />
          <circle
            r={2.5}
            fill="red"
            cx={controlPoints.begin.x}
            cy={controlPoints.begin.y}
          />
        </>
      )}

      {controlPoints && (
        <>
          <line
            stroke="var(--pplc-stroke-color)"
            x1={controlPoints.pt.x}
            y1={controlPoints.pt.y}
            x2={controlPoints.end.x}
            y2={controlPoints.end.y}
          />
          <circle
            r={2.5}
            fill="white"
            cx={controlPoints.end.x}
            cy={controlPoints.end.y}
          />
        </>
      )}

      {controlPoints && (
        <rect
          width={10}
          height={10}
          fill="white"
          stroke="var(--pplc-stroke-color)"
          paintOrder="fill strokev"
          x={controlPoints.pt.x - 5}
          y={controlPoints.pt.y - 5}
        />
      )}
    </g>
  )
})

function tmpPathToVectorPathPoints(
  points: TmpPathPoint[],
): Document.VisuElement.VectorPathPoint[] {
  return points.map((pt, idx, list) => {
    const prev = list[idx - 1]

    return {
      isMoveTo: pt.isMoveTo,
      x: pt.x,
      y: pt.y,
      begin: prev?.beginForNext,
      end: pt.endForPrev,
    }
  })
}

function tmpPathToVectorPath(
  points: TmpPathPoint[],
): Document.VisuElement.VectorPath {
  return Document.visu.createVectorPath({
    points: tmpPathToVectorPathPoints(points),
  })
}

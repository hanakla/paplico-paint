import {
  Commands,
  Document,
  PaplicoMath,
  SVGPathManipul,
} from '@paplico/core-new'
import {
  MouseEvent,
  ReactNode,
  SVGProps,
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { useEditorStore, useEngineStore } from '@/store'
import { createUseStyles } from 'react-jss'
import { useMemoRevailidatable, usePointerDrag } from '@/utils/hooks'
import { unstable_batchedUpdates } from 'react-dom'
import { ToolModes } from '@/stores/types'
import { mapEntries } from '@paplico/shared-lib'
import { usePropsMemo } from '@paplico/shared-lib/react'
import { storePicker } from '@/utils/zustand'
import clsx from 'clsx'
import useEvent from 'react-use-event-hook'
import { radToDeg } from '@paplico/core-new/math-utils'

type Props = {
  visuUid: string
  visu: Document.VisuElement.VectorObjectElement
}

const usePathStyle = createUseStyles({
  root: {
    pointerEvents: 'stroke',
    '&[data-state-selected="true"]': {
      pointerEvents: 'painted',
    },
  },
  point: {
    width: 10,
    height: 10,
    strokeWidth: 2,
    stroke: '#4e7fff',
    paintOrder: 'stroke fill',
    fill: '#fff',
    r: 2,
  },
  previewStroke: {
    stroke: 'transparent',
    cursor: 'pointer',
    touchAction: 'none',
    "&:where([data-state-selected='true'] > *)": {
      stroke: 'var(--pplc-stroke-color)',
    },
    '&:hover': {
      stroke: 'var(--pplc-stroke-color)',
    },
  },
  poitoToAnchorLine: {
    stroke: 'var(--pplc-stroke-color)',
    pointerEvents: 'none',
  },
  disableTouchAction: {
    touchAction: 'none',
  },
})

export const VectorObjectElement = memo(function VectorObjectElement({
  visuUid,
  visu,
}: Props) {
  const editor = useEditorStore(storePicker(['toolMode', 'selectedVisuUidMap']))
  const isEditableToolMode =
    editor.toolMode === ToolModes.objectTool ||
    editor.toolMode === ToolModes.pointTool ||
    editor.toolMode === ToolModes.curveTool ||
    (editor.toolMode === ToolModes.vectorPenTool &&
      editor.selectedVisuUidMap[visu.uid])

  if (!isEditableToolMode) return null

  return <VectorObjectElementInternal visuUid={visuUid} visu={visu} />
})

export const VectorObjectElementInternal = memo(function VectorObjectElement({
  visuUid,
  visu,
}: Props) {
  const editor = useEditorStore(
    storePicker([
      'toolMode',
      'canvasScale',
      'selectedVisuUidMap',
      'setSelectedVisuUids',
      'setSelectedPoints',
      'setVisuTransformOverride',
      'vectorPenLastPoint',
      'setVectorPenLastPoint',
    ]),
  )

  const isSelected = editor.selectedVisuUidMap[visu.uid]
  const isPointToolMode = editor.toolMode === ToolModes.pointTool
  const isCurveToolMode = editor.toolMode === ToolModes.curveTool

  const { paplico } = useEngineStore()
  const s = usePathStyle()
  const propsMemo = usePropsMemo()

  const elementScale = 1

  const [pointMoveOverride, setPointMoveOverride] = useState<{
    idxs: number[]
    x: number
    y: number
    beginX: number
    beginY: number
    endX: number
    endY: number
  } | null>(null)

  const [beginAnchorOverride, setBeginAnchorOverride] = useState<{
    idx: number
    x: number
    y: number
    isCurveTool?: true
  } | null>(null)

  const [endAnchorOverride, setEndAnchorOverride] = useState<{
    idx: number
    x: number
    y: number
    isCurveTool?: true
  } | null>(null)

  const onClickPath = useCallback((e: MouseEvent) => {
    editor.setSelectedVisuUids((prev) => {
      const inSelecton = prev[visu.uid]

      if (e.shiftKey && inSelecton) {
        delete prev[visu.uid]
        return { ...prev }
      }

      return e.shiftKey ? { ...prev, [visu.uid]: true } : { [visu.uid]: true }
    })
  }, [])

  const onClickPoint = useEvent(async (e: MouseEvent) => {
    if (isPointToolMode) {
      const visuUid = (e.currentTarget as HTMLElement).dataset.objectUid!
      const pointIdx = +(e.currentTarget as HTMLElement).dataset.pointIdx!

      editor.setSelectedPoints((prev) => {
        if (e.shiftKey) {
          if (prev[visuUid]?.[pointIdx]) {
            delete prev[visuUid]![pointIdx]
            return prev
          } else {
            return {
              ...prev,
              [visuUid]: { ...prev[visuUid], [pointIdx]: true },
            }
          }
        } else {
          return { [visuUid]: { [pointIdx]: true } }
        }
      })

      editor.setVectorPenLastPoint(null)
    } else if (editor.toolMode === ToolModes.vectorPenTool) {
      const visuUid = (e.currentTarget as HTMLElement).dataset.objectUid!
      const pointIdx = +(e.currentTarget as HTMLElement).dataset.pointIdx!

      if (editor.vectorPenLastPoint != null) {
        const lastPoint = editor.vectorPenLastPoint
        const nextPtOfVectorPenLast = visu.path.points[lastPoint.pointIdx + 1]

        const isEndOfFragmentPoint =
          nextPtOfVectorPenLast == null || !!nextPtOfVectorPenLast?.isMoveTo
        if (!isEndOfFragmentPoint) return

        editor.setVectorPenLastPoint({
          visu,
          pointIdx,
        })
      }
    }
  })

  const bindDrag = usePointerDrag(({ offsetMovement, last, event }) => {
    if (editor.toolMode === ToolModes.curveTool) return

    if (!last) {
      editor.setVisuTransformOverride((prev) => ({
        ...prev,
        position: {
          x: offsetMovement[0],
          y: offsetMovement[1],
        },
      }))

      paplico.requestPreviewPriolityRerender({
        transformOverrides: Object.fromEntries(
          mapEntries(editor.selectedVisuUidMap, ([uid]) => {
            return [
              uid,
              (base) => {
                base.transform.translate.x += offsetMovement[0]
                base.transform.translate.y += offsetMovement[1]
                return base
              },
            ]
          }),
        ),
      })

      // paplico.requestPreviewPriolityRerender({
      //   transformOverrides: {
      //     [visu.uid]: (base) => {
      //       base.transform.position.x += movement[0]
      //       base.transform.position.y += movement[1]
      //       return base
      //     },
      //   },
      // })
    } else {
      paplico.command.do(
        new Commands.VectorVisuUpdateAttributes(visuUid, {
          updater: (target) => {
            const prevPosition = target.transform.translate
            target.transform.translate = {
              x: prevPosition.x + offsetMovement[0],
              y: prevPosition.y + offsetMovement[1],
            }
          },
        }),
      )

      editor.setVisuTransformOverride(null)
    }
  })

  const bindDragPoint = usePointerDrag(
    ({ event, offsetInitial, offsetMovement, first, last }) => {
      const dataset = (event.currentTarget as HTMLElement)!.dataset
      const pointIdx = +dataset.pointIdx!
      const isCloseToPathHeadPoint = !!dataset.isCloseToPathHeadPoint
      const startPointIdx = dataset.startPointIdx
        ? +dataset.startPointIdx
        : null

      // console.log({
      //   dataset,
      //   event: { ...event },
      //   target: event.currentTarget,
      //   pointIdx,
      //   isCloseToPathHeadPoint,
      //   startPointIdx,
      // })
      if (pointIdx == null) return

      if (isCurveToolMode) {
        const pt = visu.path.points[pointIdx]

        const oppositeSidePos = PaplicoMath.getPointWithAngleAndDistance({
          base: { x: pt.x, y: pt.y },
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

        if (!last) {
          paplico.requestPreviewPriolityRerender({
            transformOverrides: {
              [visu.uid]: (base) => {
                if (base.type !== 'vectorObject') return base

                const point = base.path.points[pointIdx]
                // if (!point?.begin) return base

                point.begin = {
                  x: (point.begin?.x ?? 0) + offsetMovement[0],
                  y: (point.begin?.y ?? 0) + offsetMovement[1],
                }
                point.end = {
                  x: oppositeSidePos.x,
                  y: oppositeSidePos.y,
                }

                return base
              },
            },
          })

          setBeginAnchorOverride({
            idx: +pointIdx,
            x: offsetMovement[0],
            y: offsetMovement[1],
            isCurveTool: true,
          })

          setEndAnchorOverride({
            idx: +pointIdx,
            x: oppositeSidePos.x,
            y: oppositeSidePos.y,
            isCurveTool: true,
          })
        } else {
          paplico.command.do(
            new Commands.VectorVisuUpdateAttributes(visuUid, {
              updater: (target) => {
                const point = target.path.points[pointIdx]
                if (!point) return

                point.begin = {
                  x: (point.begin?.x ?? 0) + offsetMovement[0],
                  y: (point.begin?.y ?? 0) + offsetMovement[1],
                }
                point.end = {
                  x: oppositeSidePos.x,
                  y: oppositeSidePos.y,
                }
              },
            }),
          )

          setBeginAnchorOverride(null)
          setEndAnchorOverride(null)
        }
      } else if (isPointToolMode) {
        const moveX = offsetMovement[0]
        const moveY = offsetMovement[1]

        const patchPointIndices = [pointIdx]

        if (isCloseToPathHeadPoint && startPointIdx != null) {
          // if close to path head point, move head point too
          patchPointIndices.push(startPointIdx)
        }

        if (!last) {
          paplico.requestPreviewPriolityRerender({
            transformOverrides: {
              [visu.uid]: (base) => {
                if (base.type !== 'vectorObject') return base

                patchPointIndices.forEach((idx) => {
                  const point = base.path.points[idx]
                  const next = base.path.points[+idx + 1]

                  if (!point) return base

                  point.x += moveX
                  point.y += moveY

                  if ('end' in point && point.end) {
                    point.end.x += moveX
                    point.end.y += moveY
                  }

                  if (next && 'begin' in next && next.begin) {
                    next.begin.x += moveX
                    next.begin.y += moveY
                  }
                })

                return base
              },
            },
          })

          setPointMoveOverride({
            idxs: patchPointIndices,
            x: moveX,
            y: moveY,
            beginX: 0,
            beginY: 0,
            endX: 0,
            endY: 0,
          })
        } else {
          paplico.command.do(
            new Commands.VectorVisuUpdateAttributes(visuUid, {
              updater: (target) => {
                patchPointIndices.forEach((idx) => {
                  const point = target.path.points[idx]
                  const next = target.path.points[idx + 1]
                  if (!point) return

                  point.x += moveX
                  point.y += moveY

                  if (point.end) {
                    point.end.x += moveX
                    point.end.y += moveY
                  }

                  if (next?.begin) {
                    next.begin.x += moveX
                    next.begin.y += moveY
                  }
                })
              },
            }),
          )

          setPointMoveOverride(null)
        }
      }
    },
  )

  const onDblClickPoint = useCallback((e: MouseEvent) => {
    // const pointIdx = +e.currentTarget.dataset.pointIdx!
    // const prevPt = visu.path.points[pointIdx - 1]
    // const pt = visu.path.points[pointIdx]
    // const nextPt = visu.path.points[pointIdx + 1]
    // if (!pt || !prevPt || !nextPt) return
    // paplico.command.do(
    //   new Commands.VectorVisuUpdateAttributes(visuUid, {
    //     updater: (target) => {
    //       const prev = target.path.points[pointIdx - 1]
    //       const next = target.path.points[pointIdx + 1]
    //       const current = target.path.points[pointIdx]
    //       if (!prev || !next || !current) return
    //       const tan = getTangent(current.x, current.y, prev.x, prev.y)
    //       prev.end = {
    //         x: prev.x + tan.x,
    //         y: prev.y + tan.y,
    //       }
    //     },
    //   }),
    // )
  }, [])

  const bindBeginAnchorDrag = usePointerDrag(
    ({ event, delta, offsetMovement, last }) => {
      const pointIdx = event.currentTarget!.dataset!.pointIdx!

      if (!last) {
        paplico.requestPreviewPriolityRerender({
          transformOverrides: {
            [visu.uid]: (base) => {
              if (base.type !== 'vectorObject') return base

              const point = base.path.points[pointIdx]
              if (!point?.begin) return base

              point.begin.x += offsetMovement[0]
              point.begin.y += offsetMovement[1]

              return base
            },
          },
        })

        setBeginAnchorOverride({
          idx: +pointIdx,
          x: offsetMovement[0],
          y: offsetMovement[1],
        })
      } else {
        paplico.command.do(
          new Commands.VectorVisuUpdateAttributes(visuUid, {
            updater: (target) => {
              const point = target.path.points[pointIdx]
              if (!point) return

              point.begin!.x += offsetMovement[0]
              point.begin!.y += offsetMovement[1]
            },
          }),
        )

        setBeginAnchorOverride(null)
      }
    },
  )

  const bindEndAnchorDrag = usePointerDrag(
    ({ event, offsetMovement, last }) => {
      const pointIdx = event.currentTarget!.dataset!.pointIdx!

      if (!last) {
        paplico.requestPreviewPriolityRerender({
          transformOverrides: {
            [visu.uid]: (base) => {
              if (base.type !== 'vectorObject') return base

              const point = base.path.points[pointIdx]
              if (!point?.end) return base

              point.end.x += offsetMovement[0]
              point.end.y += offsetMovement[1]

              return base
            },
          },
        })

        setEndAnchorOverride({
          idx: +pointIdx,
          x: offsetMovement[0],
          y: offsetMovement[1],
        })
      } else {
        paplico.command.do(
          new Commands.VectorVisuUpdateAttributes(visuUid, {
            updater: (target) => {
              const point = target.path.points[pointIdx]
              if (!point) return

              point.end!.x += offsetMovement[0]
              point.end!.y += offsetMovement[1]
            },
          }),
        )

        setEndAnchorOverride(null)
      }
    },
  )

  useEffect(() => {
    return paplico.on('document:layerUpdated', ({ layerEntityUid }) => {
      if (layerEntityUid !== visuUid) return

      unstable_batchedUpdates(() => {
        revalidatePathElement()
        revalidateDetailElements()
      })
    })
  })

  const [clickablePathElement, revalidatePathElement] =
    useMemoRevailidatable(() => {
      const d = SVGPathManipul.vectorPathPointsToSVGPath(visu.path.points)

      return (
        <>
          <MemoPath
            stroke="transparent"
            d={d}
            strokeWidth={5}
            onClick={onClickPath}
            className={s.previewStroke}
            {...bindDrag()}
          />
        </>
      )
    }, [/* FIXME: */ visu.path, onClickPath])

  const [
    {
      pointElements,
      pathFragmentElements,
      beginAnchorElements,
      endAnchorElements,
      anchorLineElements,
    },
    revalidateDetailElements,
  ] = useMemoRevailidatable(() => {
    const pointElements: ReactNode[] = []
    const pathFragmentElements: ReactNode[] = []
    const beginAnchorElements: ReactNode[] = []
    const endAnchorElements: ReactNode[] = []
    const anchorLineElements: ReactNode[] = []

    let currentMoveToIdx = 0
    visu.path.points.forEach((pt, idx, list) => {
      if (!editor.selectedVisuUidMap[visu.uid]) return
      if (!isPointToolMode && !isCurveToolMode) return
      if (pt.isMoveTo) currentMoveToIdx = idx
      if (pt.isClose) return

      const ptOvrOffsetX = pointMoveOverride?.idxs.includes(idx)
        ? pointMoveOverride.x
        : 0
      const ptOvrOffsetY = pointMoveOverride?.idxs.includes(idx)
        ? pointMoveOverride.y
        : 0
      const beginOvrX =
        beginAnchorOverride?.idx === idx ? beginAnchorOverride.x : 0
      const beginOvrY =
        beginAnchorOverride?.idx === idx ? beginAnchorOverride.y : 0
      const endOvrX = endAnchorOverride?.idx === idx ? endAnchorOverride.x : 0
      const endOvrY = endAnchorOverride?.idx === idx ? endAnchorOverride.y : 0

      const next = list[idx + 1]
      const beginMoveTo = list[currentMoveToIdx]

      const isCloseToPathHeadPoint =
        next?.isClose && pt.x === beginMoveTo.x && pt.y === beginMoveTo.y

      pointElements.push(
        <MemoRect
          key={'pt' + idx}
          x={pt.x - 5 + ptOvrOffsetX}
          y={pt.y - 5 + ptOvrOffsetY}
          className={clsx(s.disableTouchAction, s.point)}
          {...bindDragPoint()}
          onDoubleClick={onDblClickPoint}
          data-object-uid={visu.uid}
          data-point-idx={idx}
          onClick={onClickPoint}
          {...(isCloseToPathHeadPoint
            ? {
                'data-isCloseToPathHeadPoint': isCloseToPathHeadPoint,
                'data-start-point-idx': currentMoveToIdx,
              }
            : {})}
        />,
      )

      if (idx !== 0) {
        const prev = list[idx - 1]

        const prevOvrOffsetX = pointMoveOverride?.idxs.includes(idx - 1)
          ? pointMoveOverride.x
          : 0
        const prevOvrOffsetY = pointMoveOverride?.idxs.includes(idx - 1)
          ? pointMoveOverride.y
          : 0

        // Generating path fragment
        const args = [
          'C',
          (pt.begin?.x ?? prev.x) + prevOvrOffsetX + beginOvrX,
          (pt.begin?.y ?? prev.y) + prevOvrOffsetY + beginOvrY,
          (pt.end?.x ?? pt.x) + ptOvrOffsetX + endOvrX,
          (pt.end?.y ?? pt.y) + ptOvrOffsetY + endOvrY,
          pt.x + ptOvrOffsetX,
          pt.y + ptOvrOffsetY,
        ]

        const d = `M ${prev.x + prevOvrOffsetX} ${
          prev.y + prevOvrOffsetY
        } ${args.join(' ')}`

        pathFragmentElements.push(
          <MemoPath
            key={'path' + idx}
            stroke="var(--pplc-stroke-color)"
            data-point-idx={idx}
            d={d}
          />,
        )

        // beginning of curve control point
        if (
          beginAnchorOverride?.isCurveTool &&
          beginAnchorOverride?.idx === idx
        ) {
          console.log({ beginAnchorOverride })

          // Maybe in Curve tool
          anchorLineElements.push(
            <MemoLine
              key={'begin-line' + idx}
              className={s.poitoToAnchorLine}
              strokeWidth={1}
              data-begin-line
              x1={pt.x + ptOvrOffsetX}
              y1={pt.y + ptOvrOffsetY}
              x2={pt.x + ptOvrOffsetX + beginOvrX}
              y2={pt.y + ptOvrOffsetY + beginOvrY}
            />,
          )

          beginAnchorElements.push(
            <MemoCircle
              key={'begin-control' + idx}
              r={3}
              cx={pt.x + ptOvrOffsetX + beginOvrX}
              cy={pt.y + ptOvrOffsetY + beginOvrY}
              paintOrder="stroke fill"
              fill="white"
              stroke="var(--pplc-stroke-color)"
              data-beginning-of-curve-for={idx}
              className={s.disableTouchAction}
              data-point-idx={idx}
              {...bindBeginAnchorDrag()}
            />,
          )
        } else if (prev && pt.begin) {
          anchorLineElements.push(
            <MemoLine
              key={'begin-line' + idx}
              className={s.poitoToAnchorLine}
              strokeWidth={1}
              data-begin-line
              x1={prev.x + prevOvrOffsetX}
              y1={prev.y + prevOvrOffsetY}
              x2={pt.begin.x + prevOvrOffsetX + beginOvrX}
              y2={pt.begin.y + prevOvrOffsetY + beginOvrY}
            />,
          )

          beginAnchorElements.push(
            <MemoCircle
              key={'begin-control' + idx}
              r={3}
              cx={pt.begin.x + prevOvrOffsetX + beginOvrX}
              cy={pt.begin.y + prevOvrOffsetY + beginOvrY}
              paintOrder="stroke fill"
              fill="white"
              stroke="var(--pplc-stroke-color)"
              data-beginning-of-curve-for={idx}
              className={s.disableTouchAction}
              data-point-idx={idx}
              {...bindBeginAnchorDrag()}
            />,
          )
        }

        // end of curve control point
        if (endAnchorOverride?.isCurveTool && endAnchorOverride?.idx === idx) {
          anchorLineElements.push(
            <MemoLine
              key={'end-line' + idx}
              className={s.poitoToAnchorLine}
              data-end-line
              strokeWidth={1}
              x1={pt.x + ptOvrOffsetX}
              y1={pt.y + ptOvrOffsetY}
              x2={ptOvrOffsetX + endOvrX}
              y2={ptOvrOffsetY + endOvrY}
            />,
          )

          endAnchorElements.push(
            <MemoCircle
              key={'end-control' + idx}
              r={3}
              cx={ptOvrOffsetX + endOvrX}
              cy={ptOvrOffsetY + endOvrY}
              paintOrder="stroke"
              fill="white"
              stroke="var(--pplc-stroke-color)"
              data-point-idx={idx}
              className={s.disableTouchAction}
              {...bindEndAnchorDrag()}
            />,
          )
        } else if (pt.end) {
          anchorLineElements.push(
            <MemoLine
              key={'end-line' + idx}
              className={s.poitoToAnchorLine}
              data-end-line
              strokeWidth={1}
              x1={pt.x + ptOvrOffsetX}
              y1={pt.y + ptOvrOffsetY}
              x2={pt.end.x + ptOvrOffsetX + endOvrX}
              y2={
                pt.end.y +
                ptOvrOffsetY +
                (endAnchorOverride?.idx === idx ? endAnchorOverride.y : 0)
              }
            />,
          )

          endAnchorElements.push(
            <MemoCircle
              key={'end-control' + idx}
              r={3}
              cx={pt.end.x + ptOvrOffsetX + endOvrX}
              cy={pt.end.y + ptOvrOffsetY + endOvrY}
              paintOrder="stroke"
              fill="white"
              stroke="var(--pplc-stroke-color)"
              data-point-idx={idx}
              className={s.disableTouchAction}
              {...bindEndAnchorDrag()}
            />,
          )
        }
      }
    })

    return {
      anchorLineElements,
      pointElements,
      pathFragmentElements,
      beginAnchorElements,
      endAnchorElements,
    }
  }, [
    visu.path,
    visu.path.points,
    editor.selectedVisuUidMap[visu.uid],
    isPointToolMode,
    isCurveToolMode,
    pointMoveOverride,
    beginAnchorOverride,
    endAnchorOverride,
  ])

  return (
    <g
      data-pap-component="ObjectPath"
      style={{
        transform: `translate(${visu.transform.translate.x}px, ${
          visu.transform.translate.y
        }px) scale(${visu.transform.scale.x}, ${
          visu.transform.scale.y
        }) rotate(${radToDeg(visu.transform.rotate)}deg)})`,
      }}
      className={s.root}
      data-state-selected={isSelected}
    >
      {propsMemo.memo(
        'object-children',
        () => (
          <>
            {anchorLineElements}
            {clickablePathElement}
            {pathFragmentElements}
            {pointElements}
            {beginAnchorElements}
            {endAnchorElements}
          </>
        ),
        [
          anchorLineElements,
          clickablePathElement,
          pathFragmentElements,
          pointElements,
          beginAnchorElements,
          endAnchorElements,
        ],
      )}
    </g>
  )
})

const MemoPath = memo(function Path(props: SVGProps<SVGPathElement>) {
  return <path {...props} />
})

const MemoLine = memo(function Line(props: SVGProps<SVGLineElement>) {
  return <line {...props} />
})

const MemoCircle = memo(function Circle(props: SVGProps<SVGCircleElement>) {
  return <circle {...props} />
})

const MemoRect = memo(function Rect(props: SVGProps<SVGRectElement>) {
  return <rect {...props} />
})

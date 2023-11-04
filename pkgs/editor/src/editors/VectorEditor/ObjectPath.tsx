import { Commands, Document, SVGPathManipul } from '@paplico/core-new'
import {
  MouseEvent,
  ReactNode,
  SVGProps,
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { useDrag } from '@use-gesture/react'
import { useEditorStore, useEngineStore } from '@/store'
import { createUseStyles } from 'react-jss'
import {
  useMemoRevailidatable,
  usePointerDrag,
  usePropsMemo,
} from '@/utils/hooks'
import { unstable_batchedUpdates } from 'react-dom'
import { storePicker } from '@/utils/zutrand'
import { VectorObject } from '@paplico/core-new/dist/Document'
import { VectorToolModes } from '@/stores/types'
import { getTangent } from '@/utils/math'

type Props = {
  layerUid: string
  object: Document.VectorObject | Document.VectorGroup
}

export const ObjectPath = memo(function ObjectPath({
  layerUid,
  object,
}: Props) {
  if (object.type === 'vectorGroup') return null

  return <ObjectPathInternal layerUid={layerUid} object={object} />
})

export const ObjectPathInternal = memo(function ObjectPath({
  layerUid,
  object,
}: {
  layerUid: string
  object: VectorObject
}) {
  const {
    canvasScale,
    setSelectedObjectIds,
    selectedObjectIds,
    vectorToolMode,
  } = useEditorStore(
    storePicker([
      'canvasScale',
      'setSelectedObjectIds',
      'selectedObjectIds',
      'vectorToolMode',
    ]),
  )

  const { paplico } = useEngineStore()
  const s = usePathStyle()
  const propsMemo = usePropsMemo()

  const elementScale = 1 / canvasScale

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
  } | null>(null)

  const [endAnchorOverride, setEndAnchorOverride] = useState<{
    idx: number
    x: number
    y: number
  } | null>(null)

  const onClickPath = useCallback((e: MouseEvent) => {
    setSelectedObjectIds((prev) => {
      const inSelecton = prev[object.uid]

      if (e.shiftKey && inSelecton) {
        delete prev[object.uid]
        return { ...prev }
      }

      return e.shiftKey
        ? { ...prev, [object.uid]: true }
        : { [object.uid]: true }
    })
  }, [])

  const bindDrag = usePointerDrag(({ movement, last, event }) => {
    if (!last) {
      paplico.requestIdleRerender({
        vectorObjectOverrides: {
          [layerUid]: {
            [object.uid]: (base) => {
              base.transform.position.x += movement[0] / canvasScale
              base.transform.position.y += movement[1] / canvasScale
              return base
            },
          },
        },
      })
    } else {
      paplico.command.do(
        new Commands.VectorUpdateObjects(layerUid, {
          updater: (objects) => {
            const target = objects.find((obj) => obj.uid === object.uid)
            if (!target) return

            const prevPosition = target.transform.position
            target.transform.position = {
              x: prevPosition.x + movement[0] / canvasScale,
              y: prevPosition.y + movement[1] / canvasScale,
            }
          },
        }),
      )
    }
  })

  const bindDragPoint = usePointerDrag(({ event, offsetMovement, last }) => {
    const dataset = (event.currentTarget as HTMLElement)!.dataset
    const pointIdx = +dataset.pointIdx!
    const isCloseToPathHeadPoint = !!dataset.isCloseToPathHeadPoint
    const startPointIdx = dataset.startPointIdx ? +dataset.startPointIdx : null

    // console.log({
    //   dataset,
    //   event: { ...event },
    //   target: event.currentTarget,
    //   pointIdx,
    //   isCloseToPathHeadPoint,
    //   startPointIdx,
    // })
    if (pointIdx == null) return

    const moveX = offsetMovement[0]
    const moveY = offsetMovement[1]

    const patchPointIndices = [pointIdx]
    if (isCloseToPathHeadPoint && startPointIdx != null) {
      patchPointIndices.push(startPointIdx)
    }

    if (!last) {
      paplico.requestIdleRerender({
        vectorObjectOverrides: {
          [layerUid]: {
            [object.uid]: (base) => {
              patchPointIndices.forEach((idx) => {
                const point = base.path.points[idx]
                const next = base.path.points[+idx + 1]

                if (!point) return base

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

              return base
            },
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
        new Commands.VectorUpdateObjects(layerUid, {
          updater: (objects) => {
            const target = objects.find((obj) => obj.uid === object.uid)
            if (!target || target.type !== 'vectorObject') return

            patchPointIndices.forEach((idx) => {
              const point = target.path.points[idx]
              const next = target.path.points[idx + 1]
              if (!point) return

              point.x += moveX / canvasScale
              point.y += moveY / canvasScale

              if (point.end) {
                point.end.x += moveX / canvasScale
                point.end.y += moveY / canvasScale
              }

              if (next?.begin) {
                next.begin.x += moveX / canvasScale
                next.begin.y += moveY / canvasScale
              }
            })
          },
        }),
      )

      setPointMoveOverride(null)
    }
  })

  const onDblClickPoint = useCallback((e: MouseEvent) => {
    const pointIdx = +e.currentTarget.dataset.pointIdx!

    const prevPt = object.path.points[pointIdx - 1]
    const pt = object.path.points[pointIdx]
    const nextPt = object.path.points[pointIdx + 1]

    if (!pt || !prevPt || !nextPt) return

    paplico.command.do(
      new Commands.VectorUpdateObjects(layerUid, {
        updater: (objects) => {
          const target = objects.find((obj) => obj.uid === object.uid)
          if (!target || target.type !== 'vectorObject') return

          const prev = target.path.points[pointIdx - 1]
          const next = target.path.points[pointIdx + 1]
          const current = target.path.points[pointIdx]

          if (!prev || !next || !current) return

          const tan = getTangent(current.x, current.y, prev.x, prev.y)
          prev.end = {
            x: prev.x + tan.x,
            y: prev.y + tan.y,
          }
        },
      }),
    )
  }, [])

  const bindBeginAnchorDrag = usePointerDrag(
    ({ event, delta, movement, last }) => {
      const pointIdx = event.currentTarget!.dataset!.pointIdx!

      if (!last) {
        paplico.requestIdleRerender({
          vectorObjectOverrides: {
            [layerUid]: {
              [object.uid]: (base) => {
                const point = base.path.points[pointIdx]
                if (!point?.begin) return base

                point.begin.x += movement[0] / canvasScale
                point.begin.y += movement[1] / canvasScale

                return base
              },
            },
          },
        })

        setBeginAnchorOverride({
          idx: +pointIdx,
          x: movement[0],
          y: movement[1],
        })
      } else {
        paplico.command.do(
          new Commands.VectorUpdateObjects(layerUid, {
            updater: (objects) => {
              const target = objects.find((obj) => obj.uid === object.uid)
              if (!target || target.type !== 'vectorObject') return

              const point = target.path.points[pointIdx]
              if (!point) return

              point.begin!.x += movement[0] / canvasScale
              point.begin!.y += movement[1] / canvasScale
            },
          }),
        )

        setBeginAnchorOverride(null)
      }
    },
  )

  const bindEndAnchorDrag = usePointerDrag(({ event, movement, last }) => {
    const pointIdx = event.currentTarget!.dataset!.pointIdx!

    if (!last) {
      paplico.requestIdleRerender({
        vectorObjectOverrides: {
          [layerUid]: {
            [object.uid]: (base) => {
              const point = base.path.points[pointIdx]
              if (!point?.end) return base

              point.end.x += movement[0] / canvasScale
              point.end.y += movement[1] / canvasScale

              return base
            },
          },
        },
      })

      setEndAnchorOverride({ idx: +pointIdx, x: movement[0], y: movement[1] })
    } else {
      paplico.command.do(
        new Commands.VectorUpdateObjects(layerUid, {
          updater: (objects) => {
            const target = objects.find((obj) => obj.uid === object.uid)
            if (!target || target.type !== 'vectorObject') return

            const point = target.path.points[pointIdx]
            if (!point) return

            point.end!.x += movement[0] / canvasScale
            point.end!.y += movement[1] / canvasScale
          },
        }),
      )

      setEndAnchorOverride(null)
    }
  })

  useEffect(() => {
    return paplico.on('document:layerUpdated', ({ layerEntityUid }) => {
      if (layerEntityUid !== layerUid) return

      unstable_batchedUpdates(() => {
        revalidatePathElement()
        revalidateDetailElements()
      })
    })
  })

  const [pathElement, revalidatePathElement] = useMemoRevailidatable(() => {
    const d = SVGPathManipul.vectorPathPointsToSVGPathString(object.path.points)

    return (
      <>
        <MemoPath
          stroke="transparent"
          d={d}
          strokeWidth={3 * elementScale}
          onClick={onClickPath}
          className={s.previewStroke}
          style={{ cursor: 'pointer', touchAction: 'none' }}
          {...bindDrag()}
        />
      </>
    )
  }, [/* FIXME: */ object.path, onClickPath])

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
    object.path.points.forEach((pt, idx, list) => {
      if (!selectedObjectIds[object.uid]) return
      if (vectorToolMode !== VectorToolModes.pointTool) return
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
          x={pt.x - 2 + ptOvrOffsetX}
          y={pt.y - 2 + ptOvrOffsetY}
          width={4}
          height={4}
          strokeWidth={2}
          stroke="#4e7fff"
          paintOrder="stroke fill"
          fill="#fff"
          r={2}
          className={s.disableTouchAction}
          {...bindDragPoint()}
          onDoubleClick={onDblClickPoint}
          data-object-uid={object.uid}
          data-point-idx={idx}
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
            stroke="var(--pap-stroke-color)"
            data-point-idx={idx}
            d={d}
          />,
        )

        // beginning of curve control point
        if (prev && pt.begin) {
          anchorLineElements.push(
            <MemoLine
              key={'begin-line' + idx}
              className={s.poitoToAnchorLine}
              strokeWidth={1 * elementScale}
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
              r={3 * elementScale}
              cx={pt.begin.x + prevOvrOffsetX + beginOvrX}
              cy={pt.begin.y + prevOvrOffsetY + beginOvrY}
              paintOrder="stroke fill"
              fill="white"
              stroke="var(--pap-stroke-color)"
              data-beginning-of-curve-for={idx}
              className={s.disableTouchAction}
              data-point-idx={idx}
              {...bindBeginAnchorDrag()}
            />,
          )
        }

        // end of curve control point
        if (pt.end) {
          anchorLineElements.push(
            <MemoLine
              key={'end-line' + idx}
              className={s.poitoToAnchorLine}
              data-end-line
              strokeWidth={1 * elementScale}
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
              r={3 * elementScale}
              cx={pt.end.x + ptOvrOffsetX + endOvrX}
              cy={pt.end.y + ptOvrOffsetY + endOvrY}
              paintOrder="stroke"
              fill="white"
              stroke="var(--pap-stroke-color)"
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
    object.path,
    object.path.points,
    selectedObjectIds[object.uid],
    pointMoveOverride,
    beginAnchorOverride,
    endAnchorOverride,
  ])

  return (
    <g
      data-pap-component="PathObject"
      style={{
        pointerEvents: selectedObjectIds[object.uid] ? 'painted' : 'stroke',
        transform: `translate(${object.transform.position.x}px, ${object.transform.position.y}px)`,
      }}>
      {propsMemo.memo(
        'object-children',
        () => (
          <>
            {anchorLineElements}
            {pathElement}
            {pathFragmentElements}
            {pointElements}
            {beginAnchorElements}
            {endAnchorElements}
          </>
        ),
        [
          anchorLineElements,
          pathElement,
          pathFragmentElements,
          pointElements,
          beginAnchorElements,
          endAnchorElements,
        ],
      )}
    </g>
  )
})

const usePathStyle = createUseStyles({
  previewStroke: {
    stroke: 'transparent',
    '&:hover': {
      stroke: 'var(--pap-stroke-color)',
    },
  },
  poitoToAnchorLine: {
    stroke: 'var(--pap-stroke-color)',
    pointerEvents: 'none',
  },
  disableTouchAction: {
    touchAction: 'none',
  },
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
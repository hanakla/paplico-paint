import { Commands, Document } from '@paplico/core-new'
import {
  MouseEvent,
  ReactNode,
  SVGProps,
  memo,
  useCallback,
  useEffect,
  useReducer,
  useState,
} from 'react'
import { useDrag } from '@use-gesture/react'
import { useEditorStore, useEngineStore } from '@/store'
import { createUseStyles } from 'react-jss'
import { useMemoRevailidatable, usePropsMemo } from '@/utils/hooks'
import { unstable_batchedUpdates } from 'react-dom'
import { storePicker } from '@/utils/zutrand'

type Props = {
  layerUid: string
  object: Document.VectorObject | Document.VectorGroup
}

export const PathObject = memo(function PathObject({
  object,
  layerUid,
}: Props) {
  const { canvasScale, setSelectedObjectIds, selectedObjectIds } =
    useEditorStore(
      storePicker('canvasScale', 'setSelectedObjectIds', 'selectedObjectIds'),
    )

  if (object.type === 'vectorGroup') return null

  const { paplico } = useEngineStore()
  const s = usePathStyle()
  const propsMemo = usePropsMemo()

  const points = object.path.points
  const elementScale = 1 / canvasScale

  const [pointOverride, setPointOverride] = useState<{
    idx: number
    x: number
    y: number
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

  const bindDrag = useDrag(({ movement, last, event }) => {
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
        new Commands.VectorUpdateLayer(layerUid, {
          updater: (layer) => {
            const target = layer.objects.find((obj) => obj.uid === object.uid)
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

  const bindDragPoint = useDrag(({ event, movement, last }) => {
    const pointIdx = +(event.currentTarget as HTMLElement)!.dataset.pointIdx!

    if (pointIdx == null) return

    if (!last) {
      paplico.requestIdleRerender({
        vectorObjectOverrides: {
          [layerUid]: {
            [object.uid]: (base) => {
              const point = base.path.points[pointIdx]
              const next = base.path.points[+pointIdx + 1]

              if (!point) return base

              point.x += movement[0] / canvasScale
              point.y += movement[1] / canvasScale

              if (point.end) {
                point.end.x += movement[0] / canvasScale
                point.end.y += movement[1] / canvasScale
              }

              if (next?.begin) {
                next.begin.x += movement[0] / canvasScale
                next.begin.y += movement[1] / canvasScale
              }

              return base
            },
          },
        },
      })

      setPointOverride({ idx: +pointIdx, x: movement[0], y: movement[1] })
    } else {
      paplico.command.do(
        new Commands.VectorUpdateLayer(layerUid, {
          updater: (layer) => {
            const target = layer.objects.find((obj) => obj.uid === object.uid)
            if (!target || target.type !== 'vectorObject') return

            const point = target.path.points[pointIdx]
            const next = target.path.points[pointIdx + 1]
            if (!point) return

            point.x += movement[0] / canvasScale
            point.y += movement[1] / canvasScale

            if (point.end) {
              point.end.x += movement[0] / canvasScale
              point.end.y += movement[1] / canvasScale
            }

            if (next?.begin) {
              next.begin.x += movement[0] / canvasScale
              next.begin.y += movement[1] / canvasScale
            }
          },
        }),
      )

      setPointOverride(null)
    }
  })

  const bindBeginAnchorDrag = useDrag(({ event, delta, movement, last }) => {
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

      setBeginAnchorOverride({ idx: +pointIdx, x: movement[0], y: movement[1] })
    } else {
      paplico.command.do(
        new Commands.VectorUpdateLayer(layerUid, {
          updater: (layer) => {
            const target = layer.objects.find((obj) => obj.uid === object.uid)
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
  })

  const bindEndAnchorDrag = useDrag(({ event, movement, last }) => {
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
        new Commands.VectorUpdateLayer(layerUid, {
          updater: (layer) => {
            const target = layer.objects.find((obj) => obj.uid === object.uid)
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
    const d = points
      .map((pt, idx, list) => {
        if (idx === 0) {
          return `M ${pt.x} ${pt.y}`
        } else {
          const prev = list[idx - 1]

          // prettier-ignore
          return pt.begin && pt.end ? `C ${pt.begin.x} ${pt.begin.y} ${pt.end.x} ${pt.end.y} ${pt.x} ${pt.y}`
            : pt.begin == null && pt.end ? `C ${prev.x} ${prev.y} ${pt.end.x} ${pt.end.y} ${pt.x} ${pt.y}`
            : pt.begin && pt.end == null ? `C ${pt.begin.x} ${pt.begin.y} ${pt.x} ${pt.y} ${pt.x} ${pt.y}`
            : `L ${pt.x} ${pt.y}`
        }
      })
      .join(' ')

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

    let currentStartPt: (typeof points)[0] | null = null
    points.forEach((pt, idx, list) => {
      if (!selectedObjectIds[object.uid]) return

      const ptOvrOffsetX = pointOverride?.idx === idx ? pointOverride.x : 0
      const ptOvrOffsetY = pointOverride?.idx === idx ? pointOverride.y : 0
      const beginOvrX =
        beginAnchorOverride?.idx === idx ? beginAnchorOverride.x : 0
      const beginOvrY =
        beginAnchorOverride?.idx === idx ? beginAnchorOverride.y : 0
      const endOvrX = endAnchorOverride?.idx === idx ? endAnchorOverride.x : 0
      const endOvrY = endAnchorOverride?.idx === idx ? endAnchorOverride.y : 0

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
          data-object-uid={object.uid}
          data-point-idx={idx}
        />,
      )

      if (pt.isMoveTo) {
        currentStartPt = pt
      }

      if (pt.isClose) {
        return
      }

      if (idx !== 0) {
        const prev = list[idx - 1]
        const prevOvrOffsetX =
          pointOverride?.idx === idx - 1 ? pointOverride.x : 0
        const prevOvrOffsetY =
          pointOverride?.idx === idx - 1 ? pointOverride.y : 0

        // Generating path fragment
        // prettier-ignore
        const args =
            pt.begin && pt.end ? [
                'C',
                pt.begin.x + prevOvrOffsetX + beginOvrX ,
                pt.begin.y + prevOvrOffsetY + beginOvrY,
                pt.end.x + ptOvrOffsetX + endOvrX,
                pt.end.y + ptOvrOffsetY + endOvrY,
                pt.x + ptOvrOffsetX,
                pt.y + ptOvrOffsetY,
              ]
            : pt.begin == null && pt.end ? [
                'C',
                prev.x + prevOvrOffsetX + beginOvrX,
                prev.y + prevOvrOffsetY + beginOvrY,
                pt.end.x + ptOvrOffsetX+ endOvrX,
                pt.end.y + ptOvrOffsetY+ endOvrY,
                pt.x + ptOvrOffsetX,
                pt.y + ptOvrOffsetY,
              ]
            : pt.begin && pt.end == null ? [
                'C',
                pt.begin.x + prevOvrOffsetX + beginOvrX,
                pt.begin.y + prevOvrOffsetY + beginOvrY,
                pt.x + ptOvrOffsetX + endOvrX,
                pt.y + ptOvrOffsetY + endOvrY,
                pt.x + ptOvrOffsetX,
                pt.y + ptOvrOffsetY,
              ]
            : ['L', pt.x + ptOvrOffsetX, pt.y + ptOvrOffsetY]

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
    selectedObjectIds[object.uid],
    pointOverride,
    beginAnchorOverride,
    endAnchorOverride,
  ])

  return (
    <g
      data-pap-component="PathObject"
      style={{
        pointerEvents: selectedObjectIds[object.uid] ? 'painted' : 'stroke',
        transform: `translate(${object.transform.position.x}px, ${object.transform.position.y}px)`,
      }}
    >
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

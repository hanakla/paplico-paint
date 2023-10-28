import { Commands, Document } from '@paplico/core-new'
import {
  MouseEvent,
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'
import { useDrag } from '@use-gesture/react'
import { useEditorStore, useEngineStore } from '@/store'
import { createUseStyles } from 'react-jss'
import { useMemoRevailidatable } from '@/utils/hooks'
import { unstable_batchedUpdates } from 'react-dom'

type Props = {
  layerUid: string
  object: Document.VectorObject | Document.VectorGroup
}

export const PathObject = memo(function PathObject({
  object,
  layerUid,
}: Props) {
  if (object.type === 'vectorGroup') return null

  const { paplico } = useEngineStore()
  const editorStore = useEditorStore()
  const rerender = useReducer((x) => x + 1, 0)[1]
  const s = usePathStyle()
  const points = object.path.points

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
    editorStore.setSelectedObjectIds((prev) => {
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

  const bindDrag = useDrag(({ delta, movement, last }) => {
    if (!last) {
      paplico.requestIdleRerender({
        vectorObjectOverrides: {
          [layerUid]: {
            [object.uid]: (base) => {
              base.transform.position.x += movement[0]
              base.transform.position.y += movement[1]
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
              x: prevPosition.x + movement[0],
              y: prevPosition.y + movement[1],
            }
          },
        }),
      )
    }
  })

  const bindDragPoint = useDrag(({ event, movement, last }) => {
    const pointIdx = event.currentTarget!.dataset.pointIdx

    if (pointIdx == null) return

    if (!last) {
      paplico.requestIdleRerender({
        vectorObjectOverrides: {
          [layerUid]: {
            [object.uid]: (base) => {
              const point = base.path.points[pointIdx]
              if (!point) return base

              point.x += movement[0]
              point.y += movement[1]
              if (point.begin) {
                point.begin.x += movement[0]
                point.begin.y += movement[1]
              }
              if (point.end) {
                point.end.x += movement[0]
                point.end.y += movement[1]
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
            if (!point) return

            point.x += movement[0]
            point.y += movement[1]
            if (point.begin) {
              point.begin.x += movement[0]
              point.begin.y += movement[1]
            }
            if (point.end) {
              point.end.x += movement[0]
              point.end.y += movement[1]
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
              if (!point) return base

              point.begin!.x += movement[0]
              point.begin!.y += movement[1]

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

            point.begin!.x += movement[0]
            point.begin!.y += movement[1]
          },
        }),
      )

      setBeginAnchorOverride(null)
    }
  })

  const bindEndAnchorDrag = useDrag(({ event, delta, movement, last }) => {})

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
        <path
          stroke="transparent"
          d={d}
          strokeWidth={3}
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
    },
    revalidateDetailElements,
  ] = useMemoRevailidatable(() => {
    const pointElements: ReactNode[] = []
    const pathFragmentElements: ReactNode[] = []
    const beginAnchorElements: ReactNode[] = []
    const endAnchorElements: ReactNode[] = []

    points.forEach((pt, idx, list) => {
      if (editorStore.selectedObjectIds[object.uid]) {
        pointElements.push(
          <rect
            key={'pt' + idx}
            x={pt.x - 2 + (pointOverride?.idx === idx ? pointOverride.x : 0)}
            y={pt.y - 2 + (pointOverride?.idx === idx ? pointOverride.x : 0)}
            width={4}
            height={4}
            strokeWidth={2}
            stroke="#4e7fff"
            fill="#fff"
            style={{ touchAction: 'none' }}
            {...bindDragPoint()}
            data-object-uid={object.uid}
            data-point-idx={idx}
          />,
        )

        if (idx !== 0) {
          const prev = list[idx - 1]

          // prettier-ignore
          const d =
            pt.begin && pt.end ? `M ${prev.x} ${prev.y} C ${pt.begin.x} ${pt.begin.y} ${pt.end.x} ${pt.end.y} ${pt.x} ${pt.y}`
            : pt.begin == null && pt.end ? `M ${prev.x} ${prev.y} C ${prev.x} ${prev.y} ${pt.end.x} ${pt.end.y} ${pt.x} ${pt.y}`
            : pt.begin && pt.end == null ? `M ${prev.x} ${prev.y} C ${pt.begin.x} ${pt.begin.y} ${pt.x} ${pt.y} ${pt.x} ${pt.y}`
            : `M ${prev.x} ${prev.y} L ${pt.x} ${pt.y}`

          pathFragmentElements.push(
            <path key={'path' + idx} stroke="var(--pap-stroke-color)" d={d} />,
          )

          if (pt.begin) {
            beginAnchorElements.push(
              <circle
                r="3"
                cx={
                  pt.begin.x +
                  (beginAnchorOverride?.idx === idx ? beginAnchorOverride.x : 0)
                }
                cy={
                  pt.begin.y +
                  (beginAnchorOverride?.idx === idx ? beginAnchorOverride.y : 0)
                }
                paintOrder="stroke"
                fill="white"
                stroke="var(--pap-stroke-color)"
                data-point-idx={idx}
                {...bindBeginAnchorDrag()}
              />,
              <line
                data-begin-line
                stroke="var(--pap-stroke-color)"
                x1={pt.x}
                y1={pt.y}
                x2={
                  pt.begin.x +
                  (beginAnchorOverride?.idx === idx ? beginAnchorOverride.x : 0)
                }
                y2={
                  pt.begin.y +
                  (beginAnchorOverride?.idx === idx ? beginAnchorOverride.y : 0)
                }
              />,
            )
          }

          if (pt.end) {
            endAnchorElements.push(
              <circle
                r="3"
                cx={
                  pt.end.x +
                  (endAnchorOverride?.idx === idx ? endAnchorOverride.x : 0)
                }
                cy={
                  pt.end.y +
                  (endAnchorOverride?.idx === idx ? endAnchorOverride.y : 0)
                }
                paintOrder="stroke"
                fill="white"
                stroke="var(--pap-stroke-color)"
                data-point-idx={idx}
                {...bindEndAnchorDrag()}
              />,
              <line
                data-end-line
                stroke="var(--pap-stroke-color)"
                x1={pt.x}
                y1={pt.y}
                x2={
                  pt.end.x +
                  (endAnchorOverride?.idx === idx ? endAnchorOverride.x : 0)
                }
                y2={
                  pt.end.y +
                  (endAnchorOverride?.idx === idx ? endAnchorOverride.y : 0)
                }
              />,
            )
          }
        }
      }
    })

    return {
      pointElements,
      pathFragmentElements,
      beginAnchorElements,
      endAnchorElements,
    }
  }, [
    object.path,
    editorStore.selectedObjectIds[object.uid],
    pointOverride,
    beginAnchorOverride,
    endAnchorOverride,
  ])

  return (
    <g
      data-pap-component="PathObject"
      style={{
        pointerEvents: editorStore.selectedObjectIds[object.uid]
          ? 'painted'
          : 'stroke',
        transform: `translate(${object.transform.position.x}px, ${object.transform.position.y}px)`,
      }}
    >
      {pathElement}
      {pathFragmentElements}
      {pointElements}
      {beginAnchorElements}
      {endAnchorElements}
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
})

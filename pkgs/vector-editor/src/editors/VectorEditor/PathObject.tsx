import { Document } from '@paplico/core-new'
import { MouseEvent, ReactNode, memo, useCallback, useMemo } from 'react'
import { useDrag } from '@use-gesture/react'
import { useEditorStore } from '@/store'
import { createUseStyles } from 'react-jss'

type Props = {
  object: Document.VectorObject | Document.VectorGroup
}

export const PathObject = memo(function PathObject({ object }: Props) {
  if (object.type === 'vectorGroup') return null

  const editorStore = useEditorStore()
  const s = usePathStyle()
  const points = object.path.points

  const onClickPath = useCallback((e: MouseEvent) => {
    editorStore.setSelectedObjectIds((prev) => {
      console.log('click path', e.shiftKey)
      return e.shiftKey
        ? { ...prev, [object.uid]: true }
        : { [object.uid]: true }
    })
  }, [])

  const pathElement = useMemo(() => {
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
          style={{ cursor: 'pointer' }}
        />
      </>
    )
  }, [/* FIXME: */ object.path, onClickPath])

  const { pointElements, pathElements } = useMemo(() => {
    const pointElements: ReactNode[] = []
    const pathElements: ReactNode[] = []

    points.forEach((pt, idx, list) => {
      if (editorStore.selectedObjectIds[object.uid]) {
        pointElements.push(
          <rect
            key={'pt' + idx}
            x={pt.x - 2}
            y={pt.y - 2}
            width={4}
            height={4}
            strokeWidth={2}
            stroke="#4e7fff"
            fill="#fff"
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

          pathElements.push(<path key={'path' + idx} stroke="#4e7fff" d={d} />)
        }
      }
    })

    return { pointElements, pathElements }
  }, [object.path, editorStore.selectedObjectIds[object.uid]])

  return (
    <g
      data-pap-component="PathObject"
      style={{
        pointerEvents: editorStore.selectedObjectIds[object.uid]
          ? 'painted'
          : 'stroke',
      }}
    >
      {pathElement}
      {pathElements}
      {pointElements}
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

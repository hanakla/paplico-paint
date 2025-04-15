import { useEditorStore, useEngineStore } from '@/store'
import { ToolModes } from '@/stores/types'
import { usePointerDrag } from '@/utils/hooks'
import { storePicker } from '@/utils/zustand'

type Props = {
  width: number
  height: number
}

export function DragHandler({ width, height }: Props) {
  const { toolMode, viewport, setViewport } = useEditorStore(
    storePicker(['toolMode', 'viewport', 'setViewport']),
  )

  const handlers = usePointerDrag((e) => {
    const accel = e.event.shiftKey ? 2 : 1

    setViewport({
      ...viewport,
      left: viewport.left - e.delta[0] * accel,
      top: viewport.top - e.delta[1] * accel,
    })
  })

  if (toolMode !== ToolModes.scroll) return null

  return (
    <svg
      data-pplc-component="DragHandler"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        fill: 'none',
        outline: 'none',
        pointerEvents: 'all',
      }}
      tabIndex={-1}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="none"
        stroke="none"
        style={{ pointerEvents: 'all' }}
        {...handlers()}
      />
    </svg>
  )
}

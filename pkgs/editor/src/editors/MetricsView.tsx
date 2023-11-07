import { useEngineStore } from '@/store'
import { storePicker } from '@/utils/zustand'
import { roundString } from '@/utils/string'
import { memo, useEffect, useMemo, useReducer } from 'react'

type Props = {
  width: number
  height: number
}

export const MetricsView = memo(function MetricsView({ width, height }: Props) {
  const { paplico } = useEngineStore()

  useEffect(() => {
    paplico.on('document:metrics:update', () => {
      // console.log('udpdate metrics')
    })
  })

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <filter
          x="0"
          y="0"
          width="1"
          height="1"
          id="pap-editor-metrics-text-bg"
        >
          <feFlood floodColor="yellow" result="bg" />
          <feMerge>
            <feMergeNode in="bg" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[...paplico.visuMetrics?.layerMetrics!].map(([layerId, metrics]) => {
        const layer = paplico.currentDocument?.getVisuByUid(layerId)!

        return (
          <g key={layerId}>
            <text
              filter="url(#pap-editor-metrics-text-bg)"
              dominantBaseline="hanging"
              x={metrics.sourceBBox.left}
              y={metrics.sourceBBox.bottom + 2}
              fontSize={12}
            >
              {metrics.sourceUid}
              &nbsp;w: {roundString(metrics.sourceBBox.width, 2)}
              &nbsp;h: {roundString(metrics.sourceBBox.height, 2)}
              &nbsp;x: {roundString(metrics.sourceBBox.left, 2)}
              &nbsp;y: {roundString(metrics.sourceBBox.top, 2)}
            </text>

            {layer?.type === 'text' ? (
              <circle
                r={4}
                fill="red"
                cx={layer.transform.position.x}
                cy={layer.transform.position.y}
              />
            ) : null}

            <rect
              x={metrics.sourceBBox.left}
              y={metrics.sourceBBox.top}
              width={metrics.sourceBBox.width}
              height={metrics.sourceBBox.height}
              fill="none"
              stroke="red"
              strokeWidth="1"
            />
          </g>
        )
      })}
    </svg>
  )
})

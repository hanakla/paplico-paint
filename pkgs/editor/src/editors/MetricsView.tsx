import { useEngineStore } from '@/store'
import { roundString } from '@/utils/string'
import { storePicker } from '@/utils/zustand'
import { memo, useEffect, useReducer } from 'react'

type Props = {
  width: number
  height: number
}

export const MetricsView = memo(function MetricsView({ width, height }: Props) {
  const { paplico } = useEngineStore(storePicker(['paplico']))
  const rerender = useReducer((x) => x + 1, 0)[1]

  useEffect(() => {
    paplico.on('document:metrics:update', () => {
      rerender()
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

      {[...(paplico.visuMetrics?.getAllMetrices() ?? [])].map(
        ({ visuUid, originalBBox, postFilterBBox }) => {
          const visu = paplico.currentDocument?.getVisuByUid(visuUid)!
          console.log({ originalBBox })

          return (
            <g key={visuUid}>
              <text
                filter="url(#pap-editor-metrics-text-bg)"
                dominantBaseline="hanging"
                x={originalBBox.left}
                y={originalBBox.bottom + 2}
                fontSize={12}
              >
                {visu.name + `(${visuUid})`}
                &nbsp;w: {roundString(originalBBox.width, 2)}
                &nbsp;h: {roundString(originalBBox.height, 2)}
                &nbsp;x: {roundString(originalBBox.left, 2)}
                &nbsp;y: {roundString(originalBBox.top, 2)}
              </text>

              {/* {layer?.type === 'text' ? (
                <circle
                  r={4}
                  fill="red"
                  cx={layer.transform.position.x}
                  cy={layer.transform.position.y}
                />
              ) : null} */}

              <rect
                x={originalBBox.left}
                y={originalBBox.top}
                width={originalBBox.width}
                height={originalBBox.height}
                fill="none"
                stroke="red"
                strokeWidth="1"
              />
            </g>
          )
        },
      )}
    </svg>
  )
})

import { useCallback, useEffect } from 'react'
import { useUpdate } from 'react-use'
import { useLayerControl } from '../hooks/useLayers'
import { useSilkEngine } from '../hooks/useSilkEngine'

export const ControlsOverlay = ({ scale }: { scale: number }) => {
  const engine = useSilkEngine()
  const layerControl = useLayerControl()
  const rerender = useUpdate()

  // const handleLayerChanged = useCallback(() => {
  //   engine?.currentLayerBBox
  // }, [])

  useEffect(() => {
    if (!engine) return
    engine.on('activeLayerChanged', rerender)
  }, [engine])

  const bbox = engine?.currentLayerBBox ?? null

  return (
    <div
      css={`
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      `}
    >
      {layerControl.activeLayer?.layerType === 'raster' && bbox && (
        <div
          css={`
            position: absolute;
            z-index: 1;
            border: 1px solid #0ff;
            pointer-events: none;
          `}
          style={{
            top: bbox.y,
            left: bbox.x,
            width: bbox.width,
            height: bbox.height,
          }}
        />
      )}
      {layerControl.activeLayer?.layerType === 'vector' && (
        <VectorLayerControl scale={scale} />
      )}
    </div>
  )
}

const VectorLayerControl = ({ scale }: { scale: number }) => {
  const engine = useSilkEngine()
  const layerControl = useLayerControl()

  if (!engine) return null

  const bbox = engine?.currentLayerBBox ?? null
  const { currentDocument } = engine
  const { activeLayer } = layerControl

  if (!activeLayer) return null
  if (!currentDocument) return null
  if (activeLayer.layerType !== 'vector') return null

  // const [first, ...points] = activeLayer.paths
  const zoom = 1 / scale
  const { paths } = activeLayer
  console.log(paths)

  // MEMO: これ見て https://codepen.io/osublake/pen/ggYxvp
  return (
    <svg
      css={`
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
      `}
      width={currentDocument.width * 2}
      height={currentDocument.height * 2}
      viewBox={`${currentDocument.width / -2} ${currentDocument.height / -2} ${
        currentDocument.width * 2
      } ${currentDocument.height * 2}`}
    >
      {activeLayer.paths.map(({ start, points, svgPath }) => (
        <>
          <path
            css={`
              stroke: #4e7fff;
              stroke-width: 2;
              fill: none;
            `}
            d={svgPath}
          />
          {/* <polyline
            css={`
              stroke: #4e7fff;
            `}
            style={{ strokeWidth: 2 * zoom}}
            points={`${start.x},${start.y} ${points[0]?.x},${points[0]?.y}`}
          /> */}
          <rect
            css={`
              fill: #4e7fff;
              stroke: rgba(0, 0, 0, 0.2);
            `}
            x={start.x}
            y={start.y}
            width={5 * zoom}
            height={5 * zoom}
            transform={`translate(${(-5 * zoom) / 2}, ${(-5 * zoom) / 2})`}
            style={{ strokeWidth: 1 * zoom }}
          />
          {points.map((point, idx, points) => (
            <>
              <polyline
                css={`
                  stroke: #4e7fff;
                `}
                style={{ strokeWidth: 0.5 * zoom }}
                points={`${point.x},${point.y} ${point.c1x},${point.c1y}`}
              />
              <circle
                css={`
                  fill: #4e7fff;
                  stroke: rgba(0, 0, 0, 0.2);
                `}
                cx={point.c1x}
                cy={point.c1y}
                r="5"
              />

              <polyline
                css={`
                  stroke: #4e7fff;
                `}
                style={{ strokeWidth: 0.5 * zoom }}
                points={`${point.x},${point.y} ${point.c2x},${point.c2y}`}
              />
              <circle
                css={`
                  fill: #4e7fff;
                  stroke: rgba(0, 0, 0, 0.2);
                  stroke-width: 0.5;
                `}
                cx={point.c2x}
                cy={point.c2y}
                r="5"
              />

              <rect
                css={`
                  fill: #4e7fff;
                  stroke: rgba(0, 0, 0, 0.2);
                `}
                x={point.x}
                y={point.y}
                width={5 * zoom}
                height={5 * zoom}
                transform={`translate(${(-5 * zoom) / 2}, ${(-5 * zoom) / 2})`}
                style={{ strokeWidth: 1 * zoom }}
              />
            </>
          ))}
        </>
      ))}
    </svg>
  )
}

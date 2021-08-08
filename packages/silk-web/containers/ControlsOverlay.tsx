import { useLysSlice } from '@fleur/lys'
import { MouseEvent, useCallback, useEffect, useRef } from 'react'
import { useClickAway, useUpdate } from 'react-use'
import { useDrag } from 'react-use-gesture'
import { SilkBrushes, SilkEntity } from '../../silk-core/src'
import { EditorSlice } from '../domains/Editor'
import { useLayerControl } from '../hooks/useLayers'
import { useSilkEngine } from '../hooks/useSilkEngine'
import { rafDebounce } from '../utils/rafDebounce'

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
  const [editorState, editorActions] = useLysSlice(EditorSlice)
  const engine = useSilkEngine()
  const layerControl = useLayerControl()
  const rerender = useUpdate()
  const { activeLayer } = layerControl

  const debouncedRerender = useCallback(
    rafDebounce(() => {
      engine?.rerender()
      rerender()
    }),
    [engine]
  )

  if (!activeLayer) throw new Error('')
  if (activeLayer.layerType !== 'vector') throw new Error('')

  const bindHeadDrag = useDrag(async ({ delta }) => {
    const target = editorState.activeObject
    if (!target) return

    activeLayer.update(() => {
      target.path.start.x += delta[0] * (1 / scale)
      target.path.points[0].c1x += delta[0] * (1 / scale)

      target.path.start.y += delta[1] * (1 / scale)
      target.path.points[0].c1y += delta[1] * (1 / scale)
    })

    debouncedRerender()
  })

  const handleDoubleClickPath = useCallback(
    ({ currentTarget }: MouseEvent<SVGPathElement>) => {
      // 頂点追加の実装する
      // SEE: http://polymathprogrammer.com/2007/06/27/reverse-engineering-bezier-curves/
      editorActions.setActiveObject(currentTarget.dataset.objectId!)
    },
    []
  )

  const rootRef = useRef<SVGSVGElement | null>(null)
  useClickAway(rootRef, () => {
    editorActions.setActiveObject(null)
  })

  if (!engine) return null

  const bbox = engine?.currentLayerBBox ?? null
  const { currentDocument } = engine

  if (!currentDocument) return null

  // const [first, ...points] = activeLayer.paths
  const zoom = 1 / scale

  // MEMO: これ見て https://codepen.io/osublake/pen/ggYxvp
  return (
    <svg
      ref={rootRef}
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
      {activeLayer.objects.map(({ id, path }) => (
        <>
          <path
            css={`
              stroke: transparent;
              stroke-width: 2;
              fill: none;
              pointer-events: all;

              &:hover {
                stroke: #4e7fff;
              }
            `}
            style={{
              ...(editorState.activeObjectId === id
                ? { stroke: '#4e7fff' }
                : {}),
            }}
            d={path.svgPath}
            data-object-id={id}
            onClick={handleDoubleClickPath}
          />
          {editorState.activeObjectId === id && (
            <rect
              css={`
                fill: #4e7fff;
                stroke: rgba(0, 0, 0, 0.2);
                pointer-events: all;
              `}
              x={path.start.x}
              y={path.start.y}
              width={5 * zoom}
              height={5 * zoom}
              transform={`translate(${(-5 * zoom) / 2}, ${(-5 * zoom) / 2})`}
              style={{ strokeWidth: 1 * zoom }}
              {...bindHeadDrag()}
            />
          )}
          {editorState.activeObjectId == id &&
            path.points.map((point, idx, points) => (
              <PathSegment
                prevPoint={idx === 0 ? path.start : points[idx - 1]}
                path={path}
                point={point}
                index={idx}
                scale={scale}
              />
            ))}
        </>
      ))}
    </svg>
  )
}

const PathSegment = ({
  path,
  prevPoint,
  point,
  index,
  scale: scale,
}: {
  path: SilkEntity.Path
  prevPoint: { x: number; y: number }
  point: SilkEntity.Path.PathPoint
  index: number
  scale: number
}) => {
  const engine = useSilkEngine()
  const rerender = useUpdate()
  const layerControls = useLayerControl()

  if (layerControls.activeLayer?.layerType !== 'vector')
    throw new Error('Invalid layerType in PathSegment component')

  const debouncedRerender = useCallback(
    rafDebounce(() => {
      engine?.rerender()
      rerender()
    }),
    [engine]
  )

  const bindDragStartAnchor = useDrag(({ delta }) => {
    assertVectorLayer(layerControls.activeLayer)

    layerControls.activeLayer?.update(() => {
      path.points[index].c1x += delta[0] * (1 / scale)
      path.points[index].c1y += delta[1] * (1 / scale)
    })

    debouncedRerender()
  })

  const bindDragEndAnchor = useDrag(({ delta }) => {
    assertVectorLayer(layerControls.activeLayer)

    layerControls.activeLayer?.update(() => {
      path.points[index].c2x += delta[0] * (1 / scale)
      path.points[index].c2y += delta[1] * (1 / scale)
    })

    debouncedRerender()
  })

  const bindDragEndPoint = useDrag(({ delta }) => {
    assertVectorLayer(layerControls.activeLayer)

    layerControls.activeLayer?.update(() => {
      const point = path.points[index]
      const nextPoint = path.points[index + 1]
      const deltaX = delta[0] * (1 / scale)
      const deltaY = delta[1] * (1 / scale)

      if (nextPoint) nextPoint.c1x += deltaX
      point.c2x += deltaX
      point.x += deltaX

      if (nextPoint) nextPoint.c1y += deltaY
      point.c2y += deltaY
      point.y += deltaY
    })

    debouncedRerender()
  })

  const zoom = 1 / scale

  return (
    <>
      <polyline
        css={`
          stroke: #4e7fff;
          pointer-events: all;
        `}
        style={{ strokeWidth: 0.5 * zoom }}
        points={`${prevPoint.x},${prevPoint.y} ${point.c1x},${point.c1y}`}
      />
      <circle
        css={`
          fill: #4e7fff;
          stroke: rgba(0, 0, 0, 0.2);
          pointer-events: all;
        `}
        cx={point.c1x}
        cy={point.c1y}
        r="5"
        {...bindDragStartAnchor()}
      />

      <polyline
        css={`
          stroke: #4e7fff;
          pointer-events: all;
        `}
        style={{ strokeWidth: 0.5 * zoom }}
        points={`${point.x},${point.y} ${point.c2x},${point.c2y}`}
      />
      <circle
        css={`
          fill: #4e7fff;
          stroke: rgba(0, 0, 0, 0.2);
          stroke-width: 0.5;
          pointer-events: all;
        `}
        cx={point.c2x}
        cy={point.c2y}
        r="5"
        {...bindDragEndAnchor()}
      />

      <rect
        css={`
          fill: #4e7fff;
          stroke: rgba(0, 0, 0, 0.2);
          pointer-events: all;
        `}
        x={point.x}
        y={point.y}
        width={5 * zoom}
        height={5 * zoom}
        transform={`translate(${(-5 * zoom) / 2}, ${(-5 * zoom) / 2})`}
        style={{ strokeWidth: 1 * zoom }}
        {...bindDragEndPoint()}
      />
    </>
  )
}

function assertVectorLayer(
  layer: any
): asserts layer is SilkEntity.VectorLayer {
  if (layer.layerType !== 'vector')
    throw new Error('Expect VectorLayer but RasterLayer given')
}

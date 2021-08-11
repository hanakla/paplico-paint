import { useLysSlice } from '@fleur/lys'
import { MouseEvent, useCallback, useEffect, useRef } from 'react'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import { useDrag, useHover } from 'react-use-gesture'
import { SilkBrushes, SilkEntity } from '../../silk-core/src'
import { EditorSlice } from '../domains/Editor'
import { useLayerControl } from '../hooks/useLayers'
import { useSilkEngine } from '../hooks/useSilkEngine'
import { rafDebounce } from '../utils/rafDebounce'
import { deepClone } from '../utils/clone'
import { assign } from '../utils/assign'
import { useMouseTrap } from '../hooks/useMouseTrap'
import { rgba } from 'polished'

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

  const rootRef = useRef<SVGSVGElement | null>(null)

  const debouncedRerender = useCallback(
    rafDebounce(() => {
      engine?.rerender()
      rerender()
    }),
    [engine]
  )

  if (!activeLayer) throw new Error('')
  if (activeLayer.layerType !== 'vector') throw new Error('')

  const [isHoverOnPath, toggleIsHoverOnPath] = useToggle(false)

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

  const handleHoverChangePath = useCallback(
    ({ hovering }: { hovering: boolean }) => {
      toggleIsHoverOnPath(hovering)
    },
    []
  )

  const handleClickHeadPoint = useCallback((e: MouseEvent<SVGRectElement>) => {
    e.stopPropagation()

    const nextIndices = e.shiftKey
      ? [...editorState.activeObjectPointIndices, 'head' as const]
      : ['head' as const]

    editorActions.setSelectedObjectPoints(nextIndices)
  }, [])

  const handleClickPath = useCallback((objectId: string) => {
    editorActions.setActiveObject(objectId)
  }, [])

  const handleDoubleClickPath = useCallback(
    (
      objectId: string,
      segmentIndex: number,
      { x, y }: { x: number; y: number }
    ) => {
      // SEE: http://polymathprogrammer.com/2007/06/27/reverse-engineering-bezier-curves/
      ;(editorState.activeLayer as SilkEntity.VectorLayer)?.update((layer) => {
        const path = layer.objects.find((obj) => obj.id === objectId)?.path
        if (!path) return

        path.points.splice(segmentIndex, 0, {
          x,
          y,
          c1x: x + 2,
          c1y: y - 2,
          c2x: x - 2,
          c2y: y + 2,
        })
      })

      debouncedRerender()
    },
    [editorState]
  )

  useMouseTrap(rootRef, [
    {
      key: 'delete',
      handler: () => {
        console.log('del')
        assertVectorLayer(layerControl.activeLayer)
        editorActions.deleteSelectedPoints()
      },
    },
  ])

  useClickAway(rootRef, () => {
    // editorActions.setActiveObject(null)
    editorActions.setVectorStroking(null)
    editorActions.setSelectedObjectPoints([])
  })

  const bindRootDrag = useDrag(({ initial, first, last, xy, event: e }) => {
    assertVectorLayer(layerControl.activeLayer)

    if (editorState.currentTool === 'cursor') {
      editorActions.setVectorStroking(null)
      return
    }

    if (editorState.currentTool !== 'shape-pen') return

    // SEE: https://stackoverflow.com/a/42711775
    const svg = e.currentTarget! as SVGSVGElement
    const initialPt = assign(svg.createSVGPoint(), {
      x: initial[0],
      y: initial[1],
    }).matrixTransform(svg.getScreenCTM()!.inverse())
    const xyPt = assign(svg.createSVGPoint(), {
      x: xy[0],
      y: xy[1],
    }).matrixTransform(svg.getScreenCTM()!.inverse())
    const { x, y } = xyPt

    if (last) {
      // editorActions.setVectorStroking({})
      debouncedRerender()
      return
    }

    if (first) {
      const newPoint = { c1x: x, c1y: y, c2x: x, c2y: y, x, y }

      if (editorState.vectorStroking == null) {
        // Create new object
        const object = SilkEntity.VectorObject.create({
          x: 0,
          y: 0,
          path: SilkEntity.Path.create({
            start: { x, y },
            points: [newPoint],
            closed: false,
          }),
          brush: editorState.currentStroke
            ? deepClone(editorState.currentStroke)
            : null,
          fill: editorState.currentFill
            ? deepClone(editorState.currentFill)
            : null,
        })

        layerControl.activeLayer.update((layer) => {
          layer.objects.push(object)
        })

        editorActions.setActiveObject(object.id)
        editorActions.setSelectedObjectPoints([0])

        editorActions.setVectorStroking({
          objectId: object.id,
          selectedPointIndex: 0,
          isHead: true,
          isTail: false,
        })
      } else {
        // Add point to active path
        const { vectorStroking } = editorState

        layerControl.activeLayer.update((layer) => {
          const object = layer.objects.find(
            (obj) => obj.id === vectorStroking.objectId
          )

          if (!object) return

          vectorStroking.isHead
            ? object.path.points.unshift(newPoint)
            : object.path.points.push(newPoint)
        })
      }
    } else {
      const { vectorStroking } = editorState
      if (!vectorStroking) return

      layerControl.activeLayer.update((layer) => {
        const object = layer.objects.find(
          (obj) => obj.id === vectorStroking.objectId
        )
        if (!object) return

        const normalizeDegree = (angle: number) => {
          const norm = angle % 360
          return norm < 0 ? norm + 360 : norm
        }

        const targetPointIndex = vectorStroking.selectedPointIndex
        const point = object.path.points[targetPointIndex]
        const prevPoint = object.path.points[targetPointIndex - 1]
        if (!point) return

        // SEE: https://qiita.com/Hoshi_7/items/d04936883ff3eb1eed2d
        const distance = Math.hypot(xyPt.x - initialPt.x, xyPt.y - initialPt.y)

        const rad = Math.atan2(xyPt.y - initialPt.y, xyPt.x - initialPt.x)
        const degree = normalizeDegree((rad * 180) / Math.PI)

        const radBetweenPoints = Math.atan2(
          point.y - (prevPoint?.y ?? 0),
          point.x - (prevPoint?.x ?? 0)
        )
        const degreeBetweenPoints = normalizeDegree(
          (radBetweenPoints * 180) / Math.PI
        )

        const oppeseDegree = normalizeDegree(degree + 180)
        const oppeseRad = oppeseDegree * (Math.PI / 180)

        const c1x = Math.cos(oppeseRad) * distance
        const c1y = Math.sin(oppeseRad) * distance

        assign(point, {
          c1x: c1x + (prevPoint?.x ?? 0),
          c1y: c1y + (prevPoint?.y ?? 0),
          c2x: x,
          c2y: y,
        })
      })

      // Add point
      // editorState.activeObject.path.points.push({
      //   c1x: 0,
      //   c1y: 100,
      //   c2x: x - 4,
      //   c2y: y,
      //   x,
      //   y,
      // })
    }

    debouncedRerender()

    // console.log(e)
  })

  if (!engine) return null

  const bbox = engine?.currentLayerBBox ?? null
  const { currentDocument } = engine
  const { activeObject } = editorState

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
      style={{
        pointerEvents: editorState.currentTool === 'shape-pen' ? 'all' : 'none',
      }}
      // onClick={handleClickRoot}
      {...bindRootDrag()}
      tabIndex={-1}
    >
      {activeLayer.objects.map(
        (object) =>
          (editorState.vectorFocusing == null ||
            editorState.vectorFocusing.objectId == object.id) && (
            <>
              {editorState.activeObjectId === object.id && (
                <rect
                  css={`
                    z-index: 1;
                    fill: #4e7fff;
                    stroke: rgba(0, 0, 0, 0.2);
                    pointer-events: visiblePainted;
                    outline: none;
                  `}
                  x={object.path.start.x}
                  y={object.path.start.y}
                  width={5 * zoom}
                  height={5 * zoom}
                  transform={`translate(${(-5 * zoom) / 2}, ${
                    (-5 * zoom) / 2
                  })`}
                  style={{
                    strokeWidth: 1 * zoom,
                    ...(editorState.activeObjectPointIndices.includes('head')
                      ? { fill: '#4e7fff', stroke: 'rgba(0, 0, 0, 0.2)' }
                      : { fill: '#fff', stroke: '#4e7fff' }),
                  }}
                  onClick={handleClickHeadPoint}
                  {...bindHeadDrag()}
                />
              )}

              {object.path.points.map((point, idx, points) => (
                <PathSegment
                  prevPoint={
                    idx === 0
                      ? { x: object.path.start.x, y: object.path.start.y }
                      : points[idx - 1]
                  }
                  object={object}
                  path={object.path}
                  point={point}
                  pointIndex={idx}
                  scale={scale}
                  isActive={editorState.activeObjectId === object.id}
                  isFirstSegment={idx === 0}
                  isLastSegment={idx === points.length - 1}
                  hovering={
                    isHoverOnPath &&
                    (editorState.vectorFocusing == null ||
                      editorState.vectorFocusing.objectId === object.id)
                  }
                  onClick={handleClickPath}
                  onDoubleClick={handleDoubleClickPath}
                  onHoverStateChange={handleHoverChangePath}
                />
              ))}
            </>
          )
      )}
      {activeObject?.fill?.type === 'linear-gradient' && (
        <defs>
          <linearGradient id="silk-ui-linear-gradient">
            {activeObject.fill.colorPoints.map(
              ({ color: { r, g, b, a }, position }) => (
                <stop
                  offset={`${position * 100}%`}
                  stop-color={rgba(r, g, b, a)}
                />
              )
            )}
          </linearGradient>

          <g>
            <line
              x1={activeObject.fill.start.x}
              y1={activeObject.fill.start.y}
              x2={activeObject.fill.end.x}
              y2={activeObject.fill.end.y}
              stroke="url(#silk-ui-linear-gradient)"
            />
          </g>
        </defs>
      )}
    </svg>
  )
}

const PathSegment = ({
  object,
  path,
  prevPoint,
  point,
  pointIndex,
  isActive,
  isFirstSegment,
  isLastSegment,
  hovering,
  scale,
  onClick,
  onDoubleClick,
  onHoverStateChange,
}: {
  object: SilkEntity.VectorObject
  path: SilkEntity.Path
  prevPoint: { x: number; y: number }
  point: SilkEntity.Path.PathPoint
  pointIndex: number
  isActive: boolean
  isFirstSegment: boolean
  isLastSegment: boolean
  hovering: boolean
  scale: number
  onClick: (objectId: string) => void
  onDoubleClick: (
    objectId: string,
    segmentIndex: number,
    point: { x: number; y: number }
  ) => void
  onHoverStateChange: ({ hovering }: { hovering: boolean }) => void
}) => {
  const engine = useSilkEngine()
  const rerender = useUpdate()
  const layerControls = useLayerControl()
  const [editorState, editorActions] = useLysSlice(EditorSlice)

  if (layerControls.activeLayer?.layerType !== 'vector')
    throw new Error('Invalid layerType in PathSegment component')

  const debouncedRerender = useCallback(
    rafDebounce(() => {
      engine?.rerender()
      rerender()
    }),
    [engine]
  )

  const bindDragStartAnchor = useDrag(({ delta, event }) => {
    event.stopPropagation()
    assertVectorLayer(layerControls.activeLayer)

    layerControls.activeLayer?.update(() => {
      path.points[pointIndex].c1x += delta[0] * (1 / scale)
      path.points[pointIndex].c1y += delta[1] * (1 / scale)
    })

    debouncedRerender()
  })

  const bindDragEndAnchor = useDrag(({ delta, event }) => {
    event.stopPropagation()
    assertVectorLayer(layerControls.activeLayer)

    layerControls.activeLayer?.update(() => {
      path.points[pointIndex].c2x += delta[0] * (1 / scale)
      path.points[pointIndex].c2y += delta[1] * (1 / scale)
    })

    debouncedRerender()
  })

  const bindDragEndPoint = useDrag(({ delta, event }) => {
    event.stopPropagation()
    assertVectorLayer(layerControls.activeLayer)

    layerControls.activeLayer?.update(() => {
      const point = path.points[pointIndex]
      const nextPoint = path.points[pointIndex + 1]
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

  const handleClickPoint = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      e.stopPropagation()

      console.log('set')

      if (
        editorState.currentTool === 'shape-pen' &&
        editorState.activeObject &&
        (isLastSegment || isFirstSegment)
      ) {
        editorActions.setVectorStroking({
          objectId: object.id,
          selectedPointIndex: pointIndex,
          isHead: isFirstSegment,
          isTail: isLastSegment,
        })
        return
      }

      const nextIndices = e.shiftKey
        ? [...editorState.activeObjectPointIndices, pointIndex]
        : [pointIndex]

      editorActions.setSelectedObjectPoints(nextIndices)
    },
    [pointIndex, editorState]
  )

  const handleClickPath = useCallback(
    (e: MouseEvent<SVGPathElement>) => {
      e.stopPropagation()

      onClick(object.id)
    },
    [object]
  )

  const handleDoubleClickPath = useCallback(
    ({ nativeEvent: e }: MouseEvent<SVGPathElement>) => {
      e.stopPropagation()

      editorActions.set

      // SEE: https://stackoverflow.com/a/42711775
      // const svg = (e.target as SVGPathElement).ownerSVGElement!
      // const pt = svg.createSVGPoint()
      // pt.x = e.clientX
      // pt.y = e.clientY

      // const cursorPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      // onDoubleClick(object.id, pointIndex, { x: cursorPt.x, y: cursorPt.y })
    },
    [object, pointIndex]
  )

  // const handleDoubleClick = useCallback(() => {

  // }, [])

  const pathHoverBind = useHover((e) => {
    onHoverStateChange({ hovering: e.hovering })
  })

  const zoom = Math.max(1 / scale, 1)

  return (
    <g>
      <path
        css={`
          stroke: transparent;
          stroke-width: 2;
          fill: none;
          pointer-events: none;
        `}
        style={{
          ...(hovering || isActive ? { stroke: '#4e7fff' } : {}),
        }}
        d={`
          M${prevPoint.x},${prevPoint.y}
          C${point?.c1x},${point.c1y} ${point.c2x},${point.c2y} ${point.x},${point.y}
        `}
        data-object-id={object.id}
      />

      <path
        // 当たり判定ブチ上げくん
        css={`
          stroke: transparent;
          fill: none;
          pointer-events: visiblePainted;
          stroke: transparent;
        `}
        style={{
          strokeWidth: 5 * zoom,
          fill: object.fill != null ? 'transparent' : 'none',
        }}
        d={`
          M${prevPoint.x},${prevPoint.y}
          C${point?.c1x},${point.c1y} ${point.c2x},${point.c2y} ${point.x},${point.y}
        `}
        data-object-id={object.id}
        onClick={handleClickPath}
        onDoubleClick={handleDoubleClickPath}
        {...pathHoverBind()}
      />
      {isActive && (
        <>
          {/* handle from previous to current */}
          <polyline
            css={`
              stroke: #4e7fff;
              pointer-events: none;
            `}
            style={{ strokeWidth: 0.5 * zoom }}
            points={`${prevPoint.x},${prevPoint.y} ${point.c1x},${point.c1y}`}
          />
          <circle
            css={`
              fill: #4e7fff;
              stroke: rgba(0, 0, 0, 0.2);
              pointer-events: visiblePainted;
            `}
            cx={point.c1x}
            cy={point.c1y}
            r="5"
            {...bindDragStartAnchor()}
          />

          {/* handle current to previous  */}
          <polyline
            css={`
              stroke: #4e7fff;
              pointer-events: none;
            `}
            style={{ strokeWidth: 0.5 * zoom }}
            points={`${point.x},${point.y} ${point.c2x},${point.c2y}`}
          />
          <circle
            css={`
              fill: #4e7fff;
              stroke: rgba(0, 0, 0, 0.2);
              stroke-width: 0.5;
              pointer-events: visiblePainted;
            `}
            cx={point.c2x}
            cy={point.c2y}
            r="5"
            {...bindDragEndAnchor()}
          />

          <rect
            css={`
              z-index: 1;
              pointer-events: visiblePainted;
            `}
            x={point.x}
            y={point.y}
            width={5 * zoom}
            height={5 * zoom}
            transform={`translate(${(-5 * zoom) / 2}, ${(-5 * zoom) / 2})`}
            style={{
              strokeWidth: 1 * zoom,
              ...(editorState.activeObjectPointIndices.includes(pointIndex)
                ? { fill: '#4e7fff', stroke: 'rgba(0, 0, 0, 0.2)' }
                : { fill: '#fff', stroke: '#4e7fff' }),
            }}
            onClick={handleClickPoint}
            {...bindDragEndPoint()}
          />
        </>
      )}
    </g>
  )
}

function assertVectorLayer(
  layer: any
): asserts layer is SilkEntity.VectorLayer {
  if (layer.layerType !== 'vector')
    throw new Error('Expect VectorLayer but RasterLayer given')
}

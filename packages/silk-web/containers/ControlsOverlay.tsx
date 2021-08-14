import { useLysSlice } from '@fleur/lys'
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import { useDrag, useHover } from 'react-use-gesture'
import { SilkBrushes, SilkEntity, SilkHelper } from '../../silk-core/src'
import { EditorSlice } from '../domains/Editor'
import { useLayerControl } from '../hooks/useLayers'
import { useSilkEngine } from '../hooks/useSilkEngine'
import { rafDebounce } from '../utils/rafDebounce'
import { deepClone } from '../utils/clone'
import { assign } from '../utils/assign'
import { useMouseTrap } from '../hooks/useMouseTrap'
import { rgba } from 'polished'
import { any } from '../utils/anyOf'
import { useMemo } from 'react'
import { SilkWebMath } from '../utils/SilkWebMath'
import path from 'path/posix'

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
  const [hoverObjectId, setHoverObjectId] = useState<string | null>(null)

  const handleHoverChangePath = useCallback(
    ({ hovering, objectId }: { hovering: boolean; objectId: string }) => {
      toggleIsHoverOnPath(hovering)
      setHoverObjectId(objectId)
    },
    []
  )

  const handleClickPath = useCallback((objectId: string) => {
    editorActions.setActiveObject(objectId)
  }, [])

  const handleDoubleClickPath = useCallback(
    (
      objectId: string,
      segmentIndex: number,
      { x, y }: { x: number; y: number }
    ) => {
      // Insert point to current path

      // SEE: http://polymathprogrammer.com/2007/06/27/reverse-engineering-bezier-curves/
      ;(editorState.activeLayer as SilkEntity.VectorLayer)?.update((layer) => {
        const path = layer.objects.find((obj) => obj.id === objectId)?.path
        if (!path) return

        path.points.splice(segmentIndex, 0, {
          x,
          y,
          in: { x: x + 2, y: y - 2 },
          out: { x: x - 2, y: y + 2 },
        })
      })

      debouncedRerender()
    },
    [editorState]
  )

  const handleClickObjectFill = useCallback(
    ({ currentTarget }: MouseEvent<SVGPathElement>) => {
      editorActions.setActiveObject(currentTarget.dataset.objectId! ?? null)
    },
    []
  )

  const bindRootDrag = useDrag(
    ({ initial, first, last, xy, event: e }) => {
      assertVectorLayer(layerControl.activeLayer)

      if (
        editorState.currentTool === 'cursor' &&
        e.target === rootRef.current
      ) {
        editorActions.setVectorStroking(null)
        editorActions.setActiveObject(null)
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
        const newPoint = { in: null, out: null, x, y }

        let nextPointIndex: number = -1
        let nextObjectId: string = ''
        if (editorState.vectorStroking == null) {
          // When click clear space, add new VectorObject
          const object = SilkEntity.VectorObject.create({
            x: 0,
            y: 0,
            path: SilkEntity.Path.create({
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

          nextObjectId = object.id
          editorActions.setActiveObject(object.id)
          editorActions.setSelectedObjectPoints([0])
          nextPointIndex = 0
        } else {
          // Add point to active path
          const { vectorStroking } = editorState

          layerControl.activeLayer.update((layer) => {
            const object = layer.objects.find(
              (obj) => obj.id === vectorStroking.objectId
            )

            if (!object) return

            nextObjectId = object.id
            if (vectorStroking.isHead) {
              object.path.points.unshift(newPoint)
              nextPointIndex = 0
            } else if (vectorStroking.isTail) {
              object.path.points.push(newPoint)
              nextPointIndex = object.path.points.length - 1
            }
          })
        }

        editorActions.setVectorStroking({
          objectId: nextObjectId,
          selectedPointIndex: nextPointIndex,
          isHead: true,
          isTail: false,
        })
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
          if (!point) return

          // SEE: https://qiita.com/Hoshi_7/items/d04936883ff3eb1eed2d
          const distance = Math.hypot(
            xyPt.x - initialPt.x,
            xyPt.y - initialPt.y
          )

          const rad = Math.atan2(xyPt.y - initialPt.y, xyPt.x - initialPt.x)
          const degree = normalizeDegree((rad * 180) / Math.PI)

          const oppeseDegree = normalizeDegree(degree + 180)
          const oppeseRad = oppeseDegree * (Math.PI / 180)

          const c1x = Math.cos(oppeseRad) * distance
          const c1y = Math.sin(oppeseRad) * distance

          assign(point, {
            in: {
              x,
              y,
            },
            out: { x: c1x + (point?.x ?? 0), y: c1y + (point?.y ?? 0) },
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
    },
    { useTouch: true }
  )

  const bindObjectDrag = useDrag(
    ({ event, delta }) => {
      const objectId = (event.target as SVGPathElement).dataset.objectId

      editorActions.updateVectorLayer(activeLayer.id, (layer) => {
        const object = layer.objects.find((obj) => obj.id === objectId)
        if (!object) return

        object.x += delta[0] * (1 / scale)
        object.y += delta[1] * (1 / scale)
      })

      debouncedRerender()
    },
    { threshold: 2 }
  )

  useClickAway(rootRef as any, () => {
    // editorActions.setActiveObject(null)
    editorActions.setVectorStroking(null)
    editorActions.setSelectedObjectPoints([])
  })

  useMouseTrap(
    rootRef as any,
    [
      {
        key: ['del', 'backspace'],
        handler: () => {
          if (
            editorState.activeObjectPointIndices.length === 0 &&
            editorState.activeObjectId == null
          ) {
            editorActions.updateVectorLayer(activeLayer.id, (layer) => {
              const idx = layer.objects.findIndex(
                (obj) => obj.id === editorState.activeObjectId
              )
              if (idx === -1) return

              layer.objects.splice(idx, 1)
            })
          }

          assertVectorLayer(layerControl.activeLayer)
          editorActions.deleteSelectedObjectPoints()
        },
      },
    ],
    [layerControl.activeLayer]
  )

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
        outline: none;
      `}
      width={currentDocument.width * 2}
      height={currentDocument.height * 2}
      viewBox={`${currentDocument.width / -2} ${currentDocument.height / -2} ${
        currentDocument.width * 2
      } ${currentDocument.height * 2}`}
      style={{
        pointerEvents: any(editorState.currentTool).of('shape-pen', 'cursor')
          ? 'all'
          : 'none',
      }}
      {...bindRootDrag()}
      tabIndex={-1}
    >
      {activeLayer?.objects.map(
        (object) =>
          (editorState.vectorFocusing == null ||
            editorState.vectorFocusing.objectId == object.id) && (
            <g style={{ transform: `translate(${object.x}px, ${object.y}px)` }}>
              <path
                css={`
                  stroke: transparent;
                  fill: none;
                  pointer-events: visiblePainted;
                `}
                style={{
                  fill: object.fill != null ? 'transparent' : 'none',
                }}
                d={object.path.svgPath}
                onClick={handleClickObjectFill}
                data-object-id={object.id}
                {...bindObjectDrag()}
              />
              {object.path.mapPoints((point, prevPoint, idx, points) => (
                <PathSegment
                  prevPoint={prevPoint}
                  object={object}
                  path={object.path}
                  point={point}
                  pointIndex={idx}
                  scale={scale}
                  isActive={editorState.activeObjectId === object.id}
                  isFirstSegment={idx === 0}
                  isLastSegment={idx === points.length - 1}
                  hovering={isHoverOnPath && object.id === hoverObjectId}
                  onClick={handleClickPath}
                  onDoubleClick={handleDoubleClickPath}
                  onHoverStateChange={handleHoverChangePath}
                />
              ))}
            </g>
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
  prevPoint: SilkEntity.Path.PathPoint | undefined
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
  onHoverStateChange: (e: { hovering: boolean; objectId: string }) => void
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

  const bindDragStartInAnchor = useDrag(({ delta, event }) => {
    event.stopPropagation()
    assertVectorLayer(editorState.activeLayer)

    editorActions.updateVectorLayer(editorState.activeLayer.id, (layer) => {
      const path = layer.objects.find((obj) => obj.id === object.id)?.path
      const point = path?.points[pointIndex]
      if (!point?.in) return

      point.in.x += delta[0] * (1 / scale)
      point.in.y += delta[1] * (1 / scale)
    })

    debouncedRerender()
  })

  const bindDragOutAnchor = useDrag(({ delta, event }) => {
    event.stopPropagation()
    assertVectorLayer(layerControls.activeLayer)

    layerControls.activeLayer?.update((layer) => {
      const path = layer.objects.find((obj) => obj.id === object.id)?.path
      const point = path?.points[pointIndex]
      if (!point?.out) return

      point.out.x += delta[0] * (1 / scale)
      point.out.y += delta[1] * (1 / scale)
    })

    debouncedRerender()
  })

  const bindDragPoint = useDrag(({ delta, event }) => {
    event.stopPropagation()
    assertVectorLayer(layerControls.activeLayer)

    if (!editorState.activeLayer) return
    editorActions.updateVectorLayer(editorState.activeLayer.id, (layer) => {
      const point = layer.objects.find((obj) => obj.id === object.id)?.path
        .points[pointIndex]
      if (!point) return

      const deltaX = delta[0] * (1 / scale)
      const deltaY = delta[1] * (1 / scale)

      point.x += deltaX
      point.y += deltaY

      if (point.in) {
        point.in.x += deltaX
        point.in.y += deltaY
      }

      if (point.out) {
        point.out.x += deltaX
        point.out.y += deltaY
      }
    })

    debouncedRerender()
  })

  const handleClickPoint = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      e.stopPropagation()

      const {
        vectorStroking,
        currentTool,
        activeLayer,
        activeObject,
        activeObjectPointIndices,
      } = editorState

      if (vectorStroking && (isLastSegment || isFirstSegment)) {
        if (!activeLayer || !activeObject) return
        console.log('1')
        if (vectorStroking.objectId !== object.id) return
        console.log('2', vectorStroking)
        if (!vectorStroking.isTail && !vectorStroking.isHead) return
        console.log('3')

        editorActions.updateVectorLayer(activeLayer.id, (layer) => {
          const object = layer.objects.find(
            (obj) => obj.id === vectorStroking.objectId
          )
          console.log({ object })
          if (!object) return

          object.path.closed = true
        })
        return
      }

      if (
        currentTool === 'shape-pen' &&
        activeObject &&
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
        ? [...activeObjectPointIndices, pointIndex]
        : [pointIndex]

      editorActions.setSelectedObjectPoints(nextIndices)
    },
    [pointIndex, editorState]
  )

  const handleClickPath = useCallback(
    (e: MouseEvent<SVGPathElement>) => {
      e.stopPropagation()

      if (editorState.currentTool === 'shape-pen') {
        if (!prevPoint) return

        const svg = (e.target as SVGPathElement).ownerSVGElement!
        const pt = assign(svg.createSVGPoint(), {
          x: e.clientX,
          y: e.clientY,
        }).matrixTransform(svg.getScreenCTM()!.inverse())

        const angle = SilkWebMath.angleOfPoints(prevPoint, point)
        const reverseAngle = SilkWebMath.degToRad(
          SilkWebMath.deg(SilkWebMath.radToDeg(angle) + 180)
        )
        const distance = SilkWebMath.distanceOfPoint(prevPoint, point)

        editorActions.addPoint(object, pointIndex, {
          x: pt.x,
          y: pt.y,
          in: SilkWebMath.pointByAngleAndDistance({
            angle: reverseAngle,
            distance: distance / 2,
            base: pt,
          }),
          out: SilkWebMath.pointByAngleAndDistance({
            angle: angle,
            distance: distance / 2,
            base: pt,
          }),
        })

        return
      }

      onClick(object.id)
    },
    [object, prevPoint, point, pointIndex]
  )

  const handleDoubleClickPath = useCallback(
    ({ nativeEvent: e }: MouseEvent<SVGPathElement>) => {
      e.stopPropagation()

      // SEE: https://stackoverflow.com/a/42711775
      const svg = (e.target as SVGPathElement).ownerSVGElement!
      const pt = assign(svg.createSVGPoint(), {
        x: e.clientX,
        y: e.clientY,
      })

      const cursorPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      onDoubleClick(object.id, pointIndex, { x: cursorPt.x, y: cursorPt.y })
    },
    [object, pointIndex]
  )

  const handleDoubleClickInPoint = useCallback(() => {
    editorActions.updateActiveObject((object) => {
      object.path.points[pointIndex].in = null
    })
  }, [pointIndex])

  const handleDoubleClickOutPoint = useCallback(() => {
    editorActions.updateActiveObject((object) => {
      object.path.points[pointIndex].out = null
    })
  }, [pointIndex])

  // const handleDoubleClick = useCallback(() => {

  // }, [])

  const pathHoverBind = useHover((e) => {
    onHoverStateChange({ hovering: e.hovering, objectId: object.id })
  })

  const zoom = Math.max(1 / scale, 1)

  const segmentPath = prevPoint
    ? `
      M${prevPoint.x},${prevPoint.y}
      C${prevPoint.out?.x ?? prevPoint.x},${prevPoint.out?.y ?? prevPoint.y} ${
        point.in?.x ?? point.x
      },${point.in?.y ?? point.y} ${point.x},${point.y}

    `
    : ''

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
        d={segmentPath}
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
        }}
        d={segmentPath}
        data-object-id={object.id}
        onClick={handleClickPath}
        onDoubleClick={handleDoubleClickPath}
        {...pathHoverBind()}
      />
      {isActive && !(object.path.closed && isLastSegment) && (
        <>
          {/* handle from previous to current */}
          {point.in && (
            <>
              <polyline
                css={`
                  stroke: #4e7fff;
                  pointer-events: none;
                `}
                style={{ strokeWidth: 0.5 * zoom }}
                points={`${point.in.x},${point.in.y} ${point.x},${point.y}`}
              />
              <circle
                css={`
                  fill: #4e7fff;
                  stroke: rgba(0, 0, 0, 0.2);
                  pointer-events: visiblePainted;
                `}
                cx={point.in.x}
                cy={point.in.y}
                r="5"
                onDoubleClick={handleDoubleClickInPoint}
                {...bindDragStartInAnchor()}
              />
            </>
          )}

          {/* handle current to previous  */}
          {point.out && (
            <>
              <polyline
                css={`
                  stroke: #4e7fff;
                  pointer-events: none;
                `}
                style={{ strokeWidth: 0.5 * zoom }}
                points={`${point.x},${point.y} ${point.out.x},${point.out.y}`}
              />
              <circle
                css={`
                  fill: #4e7fff;
                  stroke: rgba(0, 0, 0, 0.2);
                  stroke-width: 0.5;
                  pointer-events: visiblePainted;
                `}
                cx={point.out.x}
                cy={point.out.y}
                r="5"
                onDoubleClick={handleDoubleClickOutPoint}
                {...bindDragOutAnchor()}
              />
            </>
          )}

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
            {...bindDragPoint()}
          />
        </>
      )}
    </g>
  )
}

function assertVectorLayer(
  layer: any
): asserts layer is SilkEntity.VectorLayer {
  if (layer?.layerType !== 'vector')
    throw new Error('Expect VectorLayer but RasterLayer given')
}

import { useFleurContext, useStore } from '@fleur/react'
import { Fragment, MouseEvent, useMemo, useRef, useState } from 'react'
import { useClickAway, useToggle } from 'react-use'
import { useDrag, useHover } from 'react-use-gesture'
import { createEditor, Descendant } from 'slate'
import { Slate, Editable, withReact } from 'slate-react'
import { SilkDOM } from 'silk-core'
import { deepClone } from '🙌/utils/clone'
import { assign } from '🙌/utils/assign'
import { useMouseTrap } from '🙌/hooks/useMouseTrap'
import { rgba } from 'polished'
import { any } from '🙌/utils/anyOf'
import { SilkWebMath } from '🙌/utils/SilkWebMath'
import { DOMRectReadOnly } from 'use-measure'
import { editorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunk } from '@hanakla/arma'
import { isEventIgnoringTarget } from '../helpers'

export const ControlsOverlay = ({
  editorBound,
  rotate,
  position: { x, y },
  scale,
  className,
}: {
  editorBound: DOMRectReadOnly
  rotate: number
  position: { x: number; y: number }
  scale: number
  className?: string
}) => {
  const { activeLayer, currentLayerBBox, currentDocument } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      currentLayerBBox: EditorSelector.activeLayerBBox(get),
      currentDocument: EditorSelector.currentDocument(get),
    })
  )

  const bbox = currentLayerBBox ?? { width: 0, height: 0 }

  if (!currentDocument) return null

  return (
    <svg
      width={editorBound.width}
      height={editorBound.height}
      viewBox={`0 0 ${editorBound.width} ${editorBound.height}`}
      x={editorBound.width / 2 - (currentDocument.width * scale) / 2}
      y={editorBound.height / 2 - (currentDocument.height * scale) / 2}
    >
      <g
        transform={`scale(${scale}) rotate(${rotate}) translate(${
          x - bbox.width / 2
        }, ${y - bbox.height / 2})`}
      >
        <rect x="0" y="0" width="10" height="10" fill="red" />
        {/* {activeLayer?.layerType === 'raster' && bbox && (
          // <div
          //   css={`
          //     position: absolute;
          //     z-index: 1;
          //     border: 1px solid #0ff;
          //   `}
          //   style={{
          //     top: bbox.y,
          //     left: bbox.x,
          //     width: bbox.width,
          //     height: bbox.height,
          //   }}
          // />
          <rect
            x={bbox.x}
            y={bbox.y}
            width={bbox.width}
            height={bbox.height}
            stroke="#0ff"
          />
        )} */}
        {activeLayer?.layerType === 'raster' && <RasterLayerControl />}
        {activeLayer?.layerType === 'vector' && (
          <VectorLayerControl scale={scale} />
        )}
        {activeLayer?.layerType === 'text' && <TextLayerControl />}
      </g>
    </svg>
  )
}

const RasterLayerControl = () => {
  const { session, currentDocument } = useStore((get) => ({
    session: EditorSelector.currentSession(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const bbox = session?.currentLayerBBox ?? null

  if (!bbox || !currentDocument) return null

  return (
    <>
      <rect
        css={`
          fill: none;
          stroke: #0ff;
        `}
        x={bbox.x}
        y={bbox.y}
        width={bbox?.width}
        height={bbox?.height}
      />
    </>
  )
}

const VectorLayerControl = ({ scale }: { scale: number }) => {
  const { executeOperation } = useFleurContext()
  const {
    activeLayer,
    currentDocument,
    currentTool,
    vectorStroking,
    currentStroke,
    currentFill,
    activeObjectPointIndices,
    activeObjectId,
    vectorFocusing,
    activeObject,
  } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    currentDocument: EditorSelector.currentDocument(get),
    currentTool: get(EditorStore).state.currentTool,
    vectorStroking: get(EditorStore).state.vectorStroking,
    currentStroke: get(EditorStore).state.currentStroke,
    currentFill: get(EditorStore).state.currentFill,
    activeObjectPointIndices: get(EditorStore).state.activeObjectPointIndices,
    activeObjectId: get(EditorStore).state.activeObjectId,
    vectorFocusing: get(EditorStore).state.vectorFocusing,
    activeObject: EditorSelector.activeObject(get),
  }))

  const rootRef = useRef<SVGSVGElement | null>(null)

  if (!activeLayer || activeLayer.layerType !== 'vector') throw new Error('')

  const [isHoverOnPath, toggleIsHoverOnPath] = useToggle(false)
  const [hoverObjectId, setHoverObjectId] = useState<string | null>(null)

  const handleHoverChangePath = useFunk(
    ({ hovering, objectId }: { hovering: boolean; objectId: string }) => {
      toggleIsHoverOnPath(hovering)
      setHoverObjectId(objectId)
    }
  )

  const handleClickPath = useFunk((objectId: string) => {
    executeOperation(editorOps.setActiveObject, objectId)
  })

  const handleDoubleClickPath = useFunk(
    (
      objectId: string,
      segmentIndex: number,
      { x, y }: { x: number; y: number }
    ) => {
      // Insert point to current path

      // SEE: http://polymathprogrammer.com/2007/06/27/reverse-engineering-bezier-curves/
      executeOperation(
        editorOps.updateVectorLayer,
        activeLayer.uid,
        (layer) => {
          const path = layer.objects.find((obj) => obj.uid === objectId)?.path
          if (!path) return

          path.points.splice(segmentIndex, 0, {
            x,
            y,
            in: { x: x + 2, y: y - 2 },
            out: { x: x - 2, y: y + 2 },
          })
        }
      )
    }
  )

  const handleClickObjectFill = useFunk(
    ({ currentTarget }: MouseEvent<SVGPathElement>) => {
      executeOperation(
        editorOps.setActiveObject,
        currentTarget.dataset.objectId! ?? null
      )
    }
  )

  const bindRootDrag = useDrag(
    ({ initial, first, last, xy, event: e }) => {
      assertVectorLayer(activeLayer)

      if (currentTool === 'cursor' && e.target === rootRef.current) {
        executeOperation(editorOps.setVectorStroking, null)
        executeOperation(editorOps.setActiveObject, null)
        return
      }

      if (currentTool !== 'shape-pen') return

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
        return
      }

      if (first) {
        const newPoint = { in: null, out: null, x, y }

        let nextPointIndex: number = -1
        let nextObjectId: string = ''
        if (vectorStroking == null) {
          // When click clear space, add new VectorObject
          const object = SilkDOM.VectorObject.create({
            x: 0,
            y: 0,
            path: SilkDOM.Path.create({
              points: [newPoint],
              closed: false,
            }),
            brush: currentStroke ? deepClone(currentStroke) : null,
            fill: currentFill ? deepClone(currentFill) : null,
          })

          executeOperation(
            editorOps.updateVectorLayer,
            (activeLayer.uid,
            (layer) => {
              layer.objects.push(object)
            })
          )

          nextObjectId = object.uid
          executeOperation(editorOps.setActiveObject, object.uid)
          executeOperation(editorOps.setSelectedObjectPoints, [0])
          nextPointIndex = 0
        } else {
          // Add point to active path

          executeOperation(
            editorOps.updateVectorLayer,
            activeLayer.uid,
            (layer) => {
              const object = layer.objects.find(
                (obj) => obj.uid === vectorStroking.objectId
              )

              if (!object) return

              nextObjectId = object.uid
              if (vectorStroking.isHead) {
                object.path.points.unshift(newPoint)
                nextPointIndex = 0
              } else if (vectorStroking.isTail) {
                object.path.points.push(newPoint)
                nextPointIndex = object.path.points.length - 1
              }
            }
          )
        }

        executeOperation(editorOps.setVectorStroking, {
          objectId: nextObjectId,
          selectedPointIndex: nextPointIndex,
          isHead: true,
          isTail: false,
        })
      } else {
        if (!vectorStroking) return

        executeOperation(
          editorOps.updateVectorLayer,
          activeLayer.uid,
          (layer) => {
            const object = layer.objects.find(
              (obj) => obj.uid === vectorStroking.objectId
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
          }
        )

        // Add point
        // activeObject.path.points.push({
        //   c1x: 0,
        //   c1y: 100,
        //   c2x: x - 4,
        //   c2y: y,
        //   x,
        //   y,
        // })
      }
    },
    { useTouch: true }
  )

  const bindObjectDrag = useDrag(
    ({ event, delta }) => {
      const objectId = (event.target as SVGPathElement).dataset.objectId

      executeOperation(
        editorOps.updateVectorLayer,
        activeLayer.uid,
        (layer) => {
          const object = layer.objects.find((obj) => obj.uid === objectId)
          if (!object) return

          object.x += delta[0] * (1 / scale)
          object.y += delta[1] * (1 / scale)
        }
      )
    },
    { threshold: 2 }
  )

  const bindObjectHover = useHover(({ hovering, event: { currentTarget } }) => {
    toggleIsHoverOnPath(hovering)
    setHoverObjectId((currentTarget as SVGPathElement)!.dataset.objectId!)
  })

  useClickAway(rootRef as any, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    executeOperation(editorOps.setVectorStroking, null)
    executeOperation(editorOps.setSelectedObjectPoints, [])
  })

  useMouseTrap(
    rootRef as any,
    [
      {
        key: ['del', 'backspace'],
        handler: () => {
          if (activeObjectPointIndices.length === 0 && activeObjectId == null) {
            executeOperation(
              editorOps.updateVectorLayer,
              activeLayer.uid,
              (layer) => {
                const idx = layer.objects.findIndex(
                  (obj) => obj.uid === activeObjectId
                )
                if (idx === -1) return

                layer.objects.splice(idx, 1)
              }
            )
          }

          assertVectorLayer(activeLayer)
          executeOperation(editorOps.deleteSelectedObjectPoints)
        },
      },
    ],
    [activeObjectPointIndices, activeObjectId, activeLayer]
  )

  if (!currentDocument) return null

  const zoom = 1 / scale

  // MEMO: これ見て https://codepen.io/osublake/pen/ggYxvp
  return (
    <svg
      ref={rootRef}
      css={`
        outline: none;
      `}
      width={currentDocument.width}
      height={currentDocument.height}
      viewBox={`0 0 ${currentDocument.width} ${currentDocument.height}`}
      style={{
        pointerEvents: any(currentTool).of('shape-pen', 'cursor')
          ? 'all'
          : 'none',
      }}
      {...bindRootDrag()}
      tabIndex={-1}
    >
      {activeLayer.objects.map(
        (object) =>
          (vectorFocusing == null ||
            vectorFocusing?.objectId == object.uid) && (
            <g
              key={object.uid}
              style={{ transform: `translate(${object.x}px, ${object.y}px)` }}
            >
              <path
                css={`
                  stroke: none;
                  fill: none;
                  pointer-events: visiblePainted;
                `}
                style={{
                  fill: object.fill != null ? 'transparent' : 'none',
                }}
                d={object.path.svgPath}
                onClick={handleClickObjectFill}
                data-object-id={object.uid}
                {...bindObjectHover()}
                {...bindObjectDrag()}
              />
            </g>
          )
      )}

      <PathSegments
        objects={activeLayer.objects}
        scale={scale}
        isHoverOnPath={isHoverOnPath}
        hoverObjectId={hoverObjectId}
        onClickPath={handleClickPath}
        onDoubleClickPath={handleDoubleClickPath}
        onHoverStateChange={handleHoverChangePath}
      />

      {activeObject?.fill?.type === 'linear-gradient' && (
        <GradientControl object={activeObject} scale={scale} />
      )}
    </svg>
  )
}

const GradientControl = ({
  object,
  scale,
}: {
  object: SilkDOM.VectorObject
  scale: number
}) => {
  const zoom = 1 / scale
  const objectBBox = useMemo(() => object?.path.getBoundingBox(), [object])

  if (object?.fill?.type !== 'linear-gradient') return null

  return (
    <>
      <defs>
        <linearGradient id="silk-ui-linear-gradient">
          {object.fill.colorPoints.map(
            ({ color: { r, g, b, a }, position }) => (
              <stop
                offset={`${position * 100}%`}
                stopColor={rgba(r, g, b, a)}
              />
            )
          )}
        </linearGradient>
      </defs>

      <g>
        <line
          css={`
            filter: drop-shadow(0 0 4px ${rgba('#000', 0.2)});
          `}
          x1={objectBBox?.centerX + object.fill.start.x}
          y1={objectBBox?.centerY + object.fill.start.y}
          x2={objectBBox?.centerX + object.fill.end.x}
          y2={objectBBox?.centerY + object.fill.end.y}
          stroke="#fff"
          strokeWidth={7 * zoom}
          strokeLinecap="round"
        />
        <line
          x1={objectBBox?.centerX + object.fill.start.x}
          y1={objectBBox?.centerY + object.fill.start.y}
          x2={objectBBox?.centerX + object.fill.end.x}
          y2={objectBBox?.centerY + object.fill.end.y}
          stroke="url(#silk-ui-linear-gradient)"
          strokeWidth={4 * zoom}
          strokeLinecap="round"
        />
      </g>
    </>
  )
}

const PathSegments = ({
  objects,
  scale,
  isHoverOnPath,
  hoverObjectId,
  onClickPath,
  onDoubleClickPath,
  onHoverStateChange,
}: {
  objects: SilkDOM.VectorObject[]
  scale: number
  isHoverOnPath: boolean
  hoverObjectId: string | null
  onClickPath: (objectId: string) => void
  onDoubleClickPath: (
    objectId: string,
    segmentIndex: number,
    point: { x: number; y: number }
  ) => void
  onHoverStateChange: (e: { hovering: boolean; objectId: string }) => void
}) => {
  const POINT_SIZE = 8

  const { executeOperation } = useFleurContext()
  const {
    activeLayer,
    activeObject,
    currentTool,
    vectorStroking,
    activeObjectPointIndices,
  } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    activeObject: EditorSelector.activeObject(get),
    currentTool: get(EditorStore).state.currentTool,
    vectorStroking: get(EditorStore).state.vectorStroking,
    currentStroke: get(EditorStore).state.currentStroke,
    currentFill: get(EditorStore).state.currentFill,
    activeObjectPointIndices: get(EditorStore).state.activeObjectPointIndices,
  }))

  if (activeLayer?.layerType !== 'vector')
    throw new Error('Invalid layerType in PathSegment component')

  const bindDragStartInAnchor = useDrag(({ delta, event }) => {
    event.stopPropagation()

    const { dataset } = event.currentTarget as SVGCircleElement
    const object = objects.find((obj) => obj.uid === dataset.objectId!)!
    const pointIndex = +dataset.pointIndex!

    executeOperation(editorOps.updateVectorLayer, activeLayer?.uid, (layer) => {
      const path = layer.objects.find((obj) => obj.uid === object.uid)?.path
      const point = path?.points[pointIndex]
      if (!point?.in) return

      point.in.x += delta[0] * (1 / scale)
      point.in.y += delta[1] * (1 / scale)
    })
  })

  const bindDragOutAnchor = useDrag(({ delta, event }) => {
    event.stopPropagation()

    const { dataset } = event.currentTarget as SVGCircleElement
    const object = objects.find((obj) => obj.uid === dataset.objectId!)!
    const pointIndex = +dataset.pointIndex!

    executeOperation(editorOps.updateVectorLayer, activeLayer?.uid, (layer) => {
      const path = layer.objects.find((obj) => obj.uid === object.uid)?.path
      const point = path?.points[pointIndex]
      if (!point?.out) return

      point.out.x += delta[0] * (1 / scale)
      point.out.y += delta[1] * (1 / scale)
    })
  })

  const bindDragPoint = useDrag(({ delta, event }) => {
    event.stopPropagation()

    const { dataset } = event.currentTarget as SVGElement
    const pointIndex = +dataset.pointIndex!
    const object = objects.find((obj) => obj.uid === dataset.objectId)!

    executeOperation(editorOps.updateVectorLayer, activeLayer?.uid, (layer) => {
      const point = layer.objects.find((obj) => obj.uid === object.uid)?.path
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
  })

  const handleClickPoint = useFunk((e: MouseEvent<SVGRectElement>) => {
    e.stopPropagation()

    const { dataset } = e.currentTarget
    const object = objects.find((obj) => obj.uid === dataset.objectId!)!
    const pointIndex = +dataset.pointIndex!
    const isFirstSegment = dataset.isFirstSegment != null
    const isLastSegment = dataset.isLastSegment != null

    if (vectorStroking && (isLastSegment || isFirstSegment)) {
      if (!activeLayer || !activeObject) return
      if (vectorStroking.objectId !== object.uid) return
      if (!vectorStroking.isTail && !vectorStroking.isHead) return

      executeOperation(
        editorOps.updateVectorLayer,
        activeLayer.uid,
        (layer) => {
          const object = layer.objects.find(
            (obj) => obj.uid === vectorStroking.objectId
          )

          if (!object) return

          object.path.closed = true
        }
      )

      return
    }

    if (
      currentTool === 'shape-pen' &&
      activeObject &&
      (isLastSegment || isFirstSegment)
    ) {
      executeOperation(editorOps.setVectorStroking, {
        objectId: object.uid,
        selectedPointIndex: pointIndex,
        isHead: isFirstSegment,
        isTail: isLastSegment,
      })
      return
    }

    const nextIndices = e.shiftKey
      ? [...activeObjectPointIndices, pointIndex]
      : [pointIndex]

    executeOperation(editorOps.setSelectedObjectPoints, nextIndices)
  })

  const handleClickPath = useFunk((e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()

    const { dataset } = e.currentTarget
    const object = objects.find((obj) => obj.uid === dataset.objectId!)!
    const pointIndex = +dataset.pointIndex!
    const point = object.path.points[pointIndex]
    const prevPoint = object.path.points[pointIndex - 1]

    if (currentTool === 'shape-pen') {
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

      executeOperation(editorOps.addPoint, object, pointIndex, {
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

    onClickPath(object.uid)
  })

  const handleDoubleClickPath = useFunk((e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()

    const { dataset } = e.currentTarget
    const object = objects.find((obj) => obj.uid === dataset.objectId!)!
    const pointIndex = +dataset.pointIndex!

    // SEE: https://stackoverflow.com/a/42711775
    const svg = (e.target as SVGPathElement).ownerSVGElement!
    const pt = assign(svg.createSVGPoint(), {
      x: e.clientX,
      y: e.clientY,
    })

    const cursorPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    onDoubleClickPath(object.uid, pointIndex, { x: cursorPt.x, y: cursorPt.y })
  })

  const handleDoubleClickInPoint = useFunk(
    (e: MouseEvent<SVGCircleElement>) => {
      const { dataset } = e.currentTarget
      const pointIndex = +dataset.pointIndex!

      executeOperation(editorOps.updateActiveObject, (object) => {
        object.path.points[pointIndex].in = null
      })
    }
  )

  const handleDoubleClickOutPoint = useFunk(
    (e: MouseEvent<SVGCircleElement>) => {
      const { dataset } = e.currentTarget
      const pointIndex = +dataset.pointIndex!

      executeOperation(editorOps.updateActiveObject, (object) => {
        object.path.points[pointIndex].out = null
      })
    }
  )

  const pathHoverBind = useHover((e) => {
    const { dataset } = e.event.currentTarget as any as SVGPathElement
    const object = objects.find((obj) => obj.uid === dataset.objectId!)!

    onHoverStateChange({ hovering: e.hovering, objectId: object.uid })
  })

  const zoom = Math.max(1 / scale, 1)

  const segments = useMemo(() => {
    return objects
      .map((object) => {
        return object.path.mapPoints((point, prevPoint, pointIdx, points) => {
          // prettier-ignore
          const segmentPath = prevPoint
            ? `
              M${prevPoint.x},${prevPoint.y}
              C${prevPoint.out?.x ?? prevPoint.x},
                ${prevPoint.out?.y ?? prevPoint.y} ${point.in?.x ?? point.x},
                ${point.in?.y ?? point.y} ${point.x},
                ${point.y}
              `
            : ''

          const isActive = activeObject?.uid === object.uid
          const isPointSelected = activeObjectPointIndices.includes(pointIdx)
          const isFirstSegment = pointIdx === 0
          const isLastSegment = pointIdx === points.length - 1
          const hovering = isHoverOnPath && object.uid === hoverObjectId
          const renderPoint =
            pointIdx !== points.length - 1 || !object.path.closed

          return {
            object,
            paths: (
              <Fragment key={`path-${object.uid}`}>
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
                  data-object-id={object.uid}
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
                    strokeWidth: POINT_SIZE * zoom,
                  }}
                  d={segmentPath}
                  data-object-id={object.uid}
                  data-point-index={pointIdx}
                  onClick={handleClickPath}
                  onDoubleClick={handleDoubleClickPath}
                  {...pathHoverBind()}
                />
              </Fragment>
            ),

            inControl: (
              <Fragment key={`inControl-${object.uid}`}>
                {isActive &&
                  isPointSelected &&
                  !(object.path.closed && isLastSegment) && (
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
                            r={POINT_SIZE * zoom}
                            data-object-id={object.uid}
                            data-point-index={pointIdx}
                            onDoubleClick={handleDoubleClickInPoint}
                            {...bindDragStartInAnchor()}
                          />
                        </>
                      )}
                    </>
                  )}
              </Fragment>
            ),

            outControl: (
              <Fragment key={`outControl-${object.uid}`}>
                {/* handle current to previous  */}
                {isPointSelected && point.out && (
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
                      r={POINT_SIZE * zoom}
                      data-object-id={object.uid}
                      data-point-index={pointIdx}
                      onDoubleClick={handleDoubleClickOutPoint}
                      {...bindDragOutAnchor()}
                    />
                  </>
                )}
              </Fragment>
            ),
            point:
              !renderPoint || !isActive ? null : (
                <Fragment key={`point-${object.uid}`}>
                  <rect
                    css={`
                      z-index: 1;
                      pointer-events: visiblePainted;
                    `}
                    x={point.x}
                    y={point.y}
                    width={POINT_SIZE * zoom}
                    height={POINT_SIZE * zoom}
                    transform={`translate(${(-POINT_SIZE * zoom) / 2}, ${
                      (-POINT_SIZE * zoom) / 2
                    })`}
                    style={{
                      strokeWidth: 1 * zoom,
                      ...(activeObjectPointIndices.includes(pointIdx)
                        ? { fill: '#4e7fff', stroke: 'rgba(0, 0, 0, 0.2)' }
                        : { fill: '#fff', stroke: '#4e7fff' }),
                    }}
                    data-object-id={object.uid}
                    data-point-index={pointIdx}
                    data-is-first-segment={isFirstSegment ? true : null}
                    data-is-last-segment={isLastSegment ? true : null}
                    onClick={handleClickPoint}
                    {...bindDragPoint()}
                  />
                </Fragment>
              ),
          }
        })
      })
      .flat(1)
  }, [activeObject?.uid, objects, objects.length])

  return (
    <>
      {segments.map(({ paths, inControl, outControl, object }) => (
        <Fragment key={`segment-${object.uid}`}>
          <g style={{ transform: `translate(${object.x}px, ${object.y}px)` }}>
            {paths}
            {inControl}
            {outControl}
          </g>
        </Fragment>
      ))}
      {segments.map(({ point, object }) => (
        <g
          key={`point-${object.uid}]`}
          style={{ transform: `translate(${object.x}px, ${object.y}px)` }}
        >
          {point}
        </g>
      ))}
    </>
  )
}

// const _PathSegments = ({
//   object,
//   prevPoint,
//   point,
//   pointIndex,
//   isActive,
//   isFirstSegment,
//   isLastSegment,
//   hovering,
//   scale,
//   renderPoint,
//   onClick,
//   onDoubleClick,
//   onHoverStateChange,
// }: {
//   object: SilkDOM.VectorObject
//   path: SilkDOM.Path
//   prevPoint: SilkDOM.Path.PathPoint | undefined
//   point: SilkDOM.Path.PathPoint
//   pointIndex: number
//   isActive: boolean
//   isFirstSegment: boolean
//   isLastSegment: boolean
//   hovering: boolean
//   scale: number
//   renderPoint: boolean
//   onClick: (objectId: string) => void
//   onDoubleClick: (
//     objectId: string,
//     segmentIndex: number,
//     point: { x: number; y: number }
//   ) => void
//   onHoverStateChange: (e: { hovering: boolean; objectId: string }) => void
// }) => {
//   const POINT_SIZE = 8

//   const { executeOperation } = useFleurContext()
//   const {
//     activeLayer,
//     activeObject,
//     currentTool,
//     vectorStroking,
//     activeObjectPointIndices,
//   } = useStore((get) => ({
//     activeLayer: EditorSelector.activeLayer(get),
//     activeObject: EditorSelector.activeObject(get),
//     currentTool: get(EditorStore).state.currentTool,
//     vectorStroking: get(EditorStore).state.vectorStroking,
//     currentStroke: get(EditorStore).state.currentStroke,
//     currentFill: get(EditorStore).state.currentFill,
//     activeObjectPointIndices: get(EditorStore).state.activeObjectPointIndices,
//   }))

//   if (activeLayer?.layerType !== 'vector')
//     throw new Error('Invalid layerType in PathSegment component')

//   const bindDragStartInAnchor = useDrag(({ delta, event }) => {
//     event.stopPropagation()

//     executeOperation(editorOps.updateVectorLayer, activeLayer?.id, (layer) => {
//       const path = layer.objects.find((obj) => obj.uid === object.uid)?.path
//       const point = path?.points[pointIndex]
//       if (!point?.in) return

//       point.in.x += delta[0] * (1 / scale)
//       point.in.y += delta[1] * (1 / scale)
//     })
//   })

//   const bindDragOutAnchor = useDrag(({ delta, event }) => {
//     event.stopPropagation()

//     executeOperation(editorOps.updateVectorLayer, activeLayer?.id, (layer) => {
//       const path = layer.objects.find((obj) => obj.uid === object.uid)?.path
//       const point = path?.points[pointIndex]
//       if (!point?.out) return

//       point.out.x += delta[0] * (1 / scale)
//       point.out.y += delta[1] * (1 / scale)
//     })
//   })

//   const bindDragPoint = useDrag(({ delta, event }) => {
//     event.stopPropagation()

//     executeOperation(editorOps.updateVectorLayer, activeLayer?.id, (layer) => {
//       const point = layer.objects.find((obj) => obj.uid === object.uid)?.path
//         .points[pointIndex]
//       if (!point) return

//       const deltaX = delta[0] * (1 / scale)
//       const deltaY = delta[1] * (1 / scale)

//       point.x += deltaX
//       point.y += deltaY

//       if (point.in) {
//         point.in.x += deltaX
//         point.in.y += deltaY
//       }

//       if (point.out) {
//         point.out.x += deltaX
//         point.out.y += deltaY
//       }
//     })
//   })

//   const handleClickPoint = useFunk((e: MouseEvent<SVGRectElement>) => {
//     e.stopPropagation()

//     if (vectorStroking && (isLastSegment || isFirstSegment)) {
//       if (!activeLayer || !activeObject) return
//       if (vectorStroking.objectId !== object.uid) return
//       if (!vectorStroking.isTail && !vectorStroking.isHead) return

//       executeOperation(editorOps.updateVectorLayer, activeLayer.id, (layer) => {
//         const object = layer.objects.find(
//           (obj) => obj.uid === vectorStroking.objectId
//         )

//         if (!object) return

//         object.path.closed = true
//       })
//       return
//     }

//     if (
//       currentTool === 'shape-pen' &&
//       activeObject &&
//       (isLastSegment || isFirstSegment)
//     ) {
//       executeOperation(editorOps.setVectorStroking, {
//         objectId: object.uid,
//         selectedPointIndex: pointIndex,
//         isHead: isFirstSegment,
//         isTail: isLastSegment,
//       })
//       return
//     }

//     const nextIndices = e.shiftKey
//       ? [...activeObjectPointIndices, pointIndex]
//       : [pointIndex]

//     executeOperation(editorOps.setSelectedObjectPoints, nextIndices)
//   })

//   const handleClickPath = useFunk((e: MouseEvent<SVGPathElement>) => {
//     e.stopPropagation()

//     if (currentTool === 'shape-pen') {
//       if (!prevPoint) return

//       const svg = (e.target as SVGPathElement).ownerSVGElement!
//       const pt = assign(svg.createSVGPoint(), {
//         x: e.clientX,
//         y: e.clientY,
//       }).matrixTransform(svg.getScreenCTM()!.inverse())

//       const angle = SilkWebMath.angleOfPoints(prevPoint, point)
//       const reverseAngle = SilkWebMath.degToRad(
//         SilkWebMath.deg(SilkWebMath.radToDeg(angle) + 180)
//       )
//       const distance = SilkWebMath.distanceOfPoint(prevPoint, point)

//       executeOperation(editorOps.addPoint, object, pointIndex, {
//         x: pt.x,
//         y: pt.y,
//         in: SilkWebMath.pointByAngleAndDistance({
//           angle: reverseAngle,
//           distance: distance / 2,
//           base: pt,
//         }),
//         out: SilkWebMath.pointByAngleAndDistance({
//           angle: angle,
//           distance: distance / 2,
//           base: pt,
//         }),
//       })

//       return
//     }

//     onClick(object.uid)
//   })

//   const handleDoubleClickPath = useFunk(
//     ({ nativeEvent: e }: MouseEvent<SVGPathElement>) => {
//       e.stopPropagation()

//       // SEE: https://stackoverflow.com/a/42711775
//       const svg = (e.target as SVGPathElement).ownerSVGElement!
//       const pt = assign(svg.createSVGPoint(), {
//         x: e.clientX,
//         y: e.clientY,
//       })

//       const cursorPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
//       onDoubleClick(object.uid, pointIndex, { x: cursorPt.x, y: cursorPt.y })
//     }
//   )

//   const handleDoubleClickInPoint = useFunk(() => {
//     executeOperation(editorOps.updateActiveObject, (object) => {
//       object.path.points[pointIndex].in = null
//     })
//   })

//   const handleDoubleClickOutPoint = useFunk(() => {
//     executeOperation(editorOps.updateActiveObject, (object) => {
//       object.path.points[pointIndex].out = null
//     })
//   })

//   const pathHoverBind = useHover((e) => {
//     onHoverStateChange({ hovering: e.hovering, objectId: object.uid })
//   })

//   const zoom = Math.max(1 / scale, 1)

//   const segmentPath = prevPoint
//     ? `
//       M${prevPoint.x},${prevPoint.y}
//       C${prevPoint.out?.x ?? prevPoint.x},${prevPoint.out?.y ?? prevPoint.y} ${
//         point.in?.x ?? point.x
//       },${point.in?.y ?? point.y} ${point.x},${point.y}
//     `
//     : ''

//   // const segments =

//   // return (

//   // )
// }

const TextLayerControl = ({}) => {
  const currentLayerBBox = useStore((get) => EditorSelector.activeLayerBBox)
  const editor = useMemo(() => withReact(createEditor()), [])
  // Add the initial value when setting up our state.
  const [value, setValue] = useState<Descendant[]>([
    {
      type: 'paragraph',
      children: [{ text: 'A line of text in a paragraph.' }],
    },
  ])

  const bbox = currentLayerBBox ?? null

  return (
    <div
      css={`
        position: absolute;
        left: 0;
        top: 0;
        z-index: 1000;
      `}
      style={{
        left: bbox?.x,
        top: bbox?.y,
      }}
    >
      <Slate
        editor={editor}
        value={value}
        onChange={(newValue) => setValue(newValue)}
      >
        <Editable />
      </Slate>
    </div>
  )
}

function assertVectorLayer(layer: any): asserts layer is SilkDOM.VectorLayer {
  if (layer?.layerType !== 'vector')
    throw new Error('Expect VectorLayer but RasterLayer given')
}

import { useFleurContext, useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import {
  Fragment,
  MouseEvent,
  PointerEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useClickAway, useToggle } from 'react-use'
import { useDrag, useHover } from 'react-use-gesture'
import { SilkCommands, SilkDOM } from 'silk-core'
import { rgba } from 'polished'
import { the } from '🙌/utils/anyOf'
import { SilkWebMath } from '🙌/utils/SilkWebMath'

import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunkyMouseTrap } from '🙌/hooks/useMouseTrap'
import { assign } from '🙌/utils/object'
import { deepClone } from '🙌/utils/clone'
import { isEventIgnoringTarget, normalRgbToRgbArray } from '../../helpers'
import { css } from 'styled-components'
import { useFleur } from '🙌/utils/hooks'
import { selector } from '@fleur/fleur'
import { DOMUtils } from '../../../../utils/dom'

const POINT_SIZE = 8

// const VectorEditorSelector = {
//   // isDiplayPointForObject: selector([EditorSelector.currentTool], (tool) => tool)
// }

export const VectorLayerControl = () => {
  const { executeOperation } = useFleurContext()
  const { execute } = useFleur()
  const {
    canvasScale,
    activeLayer,
    activeLayerPath,
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
    canvasScale: EditorSelector.canvasScale(get),
    activeLayer: EditorSelector.activeLayer(get),
    activeLayerPath: EditorSelector.activeLayerPath(get),
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
  const makePathTransactionRef = useRef<SilkCommands.Transaction | null>(null)

  if (!activeLayer || activeLayer.layerType !== 'vector') throw new Error('')

  const [isHoverOnPath, toggleIsHoverOnPath] = useToggle(false)
  const [hoveredObjectUid, setHoveredObjectUid] = useState<string | null>(null)

  const handleClickRoot = useFunk((e: PointerEvent<SVGSVGElement>) => {
    // console.log(e.target)
  })

  const handleHoverChangePath = useFunk(
    ({ hovering, objectId }: { hovering: boolean; objectId: string }) => {
      toggleIsHoverOnPath(hovering)
      setHoveredObjectUid(objectId)
    }
  )

  const handleClickPath = useFunk((objectId: string) => {
    executeOperation(EditorOps.setActiveObject, objectId)
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
        EditorOps.updateVectorLayer,
        activeLayerPath,
        (layer) => {
          const object = layer.objects.find((obj) => obj.uid === objectId)
          if (!object) return

          object.update((o) => {
            const path = o.path.clone()

            path.points.splice(segmentIndex, 0, {
              x,
              y,
              in: { x: x + 2, y: y - 2 },
              out: { x: x - 2, y: y + 2 },
            })
            path.freeze()

            o.path = path
          })
        }
      )
    }
  )

  const handleClickObjectOutline = useFunk(
    ({ currentTarget }: MouseEvent<SVGPathElement>) => {
      executeOperation(
        EditorOps.setActiveObject,
        currentTarget.dataset.objectUid ?? null
      )
    }
  )

  const bindRootDrag = useDrag(
    ({ initial, first, last, xy, event: e }) => {
      assertVectorLayer(activeLayer)

      if (currentTool !== 'shape-pen' || !activeLayerPath) return

      // Add point
      // SEE: https://stackoverflow.com/a/42711775
      const svg = e.currentTarget! as SVGSVGElement
      const initialPt = DOMUtils.domPointToSvgPoint(svg, {
        x: initial[0],
        y: initial[1],
      })
      const { x, y } = DOMUtils.domPointToSvgPoint(svg, {
        x: xy[0],
        y: xy[1],
      })

      if (last) {
        makePathTransactionRef.current = null
        return
      }

      if (first) {
        // Create new Object and add point
        const newPoint: SilkDOM.Path.PathPoint = {
          in: null,
          out: null,
          x,
          y,
          pressure: 1,
        }

        const cmdTransaction = (makePathTransactionRef.current =
          new SilkCommands.Transaction({
            commands: [],
          }))

        execute(EditorOps.runCommand, cmdTransaction)

        let nextPointIndex: number = -1
        let nextObjectId: string = ''

        if (vectorStroking == null) {
          // Create new object with point
          if (!activeLayerPath) return

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

          cmdTransaction.doAndAddCommand(
            new SilkCommands.VectorLayer.AddObject({
              object,
              pathToTargetLayer: activeLayerPath,
            })
          )

          nextObjectId = object.uid
          execute(EditorOps.setActiveObject, object.uid)
          execute(EditorOps.setSelectedObjectPoints, [0])
          nextPointIndex = 0
        } else {
          if (!activeLayerPath) return

          // Add point to active path
          nextObjectId = vectorStroking.objectId

          cmdTransaction.doAndAddCommand(
            new SilkCommands.VectorLayer.PatchPathPoints({
              pathToTargetLayer: activeLayerPath,
              objectUid: vectorStroking.objectId,
              patcher: (points) => {
                if (vectorStroking.isHead) {
                  points.unshift(newPoint)
                  nextPointIndex = 0
                } else if (vectorStroking.isTail) {
                  points.push(newPoint)
                  nextPointIndex = points.length - 1
                }
              },
            })
          )
        }

        executeOperation(EditorOps.setVectorStroking, {
          objectId: nextObjectId,
          selectedPointIndex: nextPointIndex,
          isHead: true,
          isTail: false,
        })
      } else {
        // Update point or curve for current path
        if (!vectorStroking) return

        execute(
          EditorOps.runCommand,
          new SilkCommands.VectorLayer.PatchPathPoints({
            pathToTargetLayer: activeLayerPath,
            objectUid: vectorStroking.objectId,
            patcher: (points) => {
              const targetPointIndex = vectorStroking.selectedPointIndex
              const point = points[targetPointIndex]
              if (!point) return

              // SEE: https://qiita.com/Hoshi_7/items/d04936883ff3eb1eed2d
              const distance = Math.hypot(x - initialPt.x, y - initialPt.y)

              const rad = Math.atan2(y - initialPt.y, x - initialPt.x)
              const degree = SilkWebMath.normalizeDegree((rad * 180) / Math.PI)

              const oppeseDegree = SilkWebMath.normalizeDegree(degree + 180)
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
            },
          })
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

  const bindObjectHover = useHover(({ hovering, event: { currentTarget } }) => {
    toggleIsHoverOnPath(hovering)
    setHoveredObjectUid(
      hovering ? (currentTarget as SVGPathElement)!.dataset.objectUid! : null
    )
  })

  const bindObjectDrag = useDrag(
    (e) => {
      const { event, delta, initial, xy, last } = e
      if (!activeLayerPath || !the(currentTool).in('cursor', 'point-cursor'))
        return

      const objectUid = (event.target as SVGPathElement).dataset.objectUid!

      if (last) {
        execute(
          EditorOps.runCommand,
          new SilkCommands.VectorLayer.TransformObject({
            pathToTargetLayer: activeLayerPath,
            objectUid: objectUid,
            transform: {
              movement: {
                x: (xy[0] - initial[0]) * (1 / canvasScale),
                y: (xy[1] - initial[1]) * (1 / canvasScale),
              },
            },
            skipDo: true,
          })
        )
      } else {
        execute(EditorOps.updateVectorLayer, activeLayerPath, (layer) => {
          const object = layer.objects.find((obj) => obj.uid === objectUid)
          if (!object) return

          object.update((o) => {
            o.x += delta[0] * (1 / canvasScale)
            o.y += delta[1] * (1 / canvasScale)
          })
        })
      }
    },
    { threshold: 2 }
  )

  useClickAway(rootRef as any, (e) => {
    // if (isEventIgnoringTarget(e.target)) return
    execute(EditorOps.setVectorStroking, null)
    execute(EditorOps.setSelectedObjectPoints, [])
  })

  useFunkyMouseTrap(rootRef, ['del', 'backspace'], () => {
    if (activeObjectPointIndices.length === 0 && activeObjectId == null) {
      execute(EditorOps.updateVectorLayer, activeLayerPath, (layer) => {
        const idx = layer.objects.findIndex((obj) => obj.uid === activeObjectId)
        if (idx === -1) return

        layer.objects.splice(idx, 1)
      })
    }

    assertVectorLayer(activeLayer)
    execute(EditorOps.deleteSelectedObjectPoints)
  })

  if (!currentDocument) return null
  if (!activeLayer.visible || activeLayer.lock) return null

  // MEMO: これ見て https://codepen.io/osublake/pen/ggYxvp
  return (
    <svg
      data-devmemo="Vector layer control"
      ref={rootRef}
      css={`
        fill: transparent;
        outline: none;
        pointer-events: none;
      `}
      width={currentDocument.width}
      height={currentDocument.height}
      viewBox={`0 0 ${currentDocument.width} ${currentDocument.height}`}
      style={{
        pointerEvents: the(currentTool).in('shape-pen', 'cursor')
          ? 'all'
          : 'none',
        stroke: '#000',
      }}
      {...bindRootDrag()}
      onClick={handleClickRoot}
      tabIndex={-1}
      overflow="visible"
    >
      <rect
        width={currentDocument.width}
        height={currentDocument.height}
        x={0}
        y={0}
      />
      {activeLayer.objects.map((object) => (
        <>
          <g
            data-devmemo="Each objects controls"
            key={object.uid}
            style={{
              transform: `translate(${object.x}, ${object.y})`,
            }}
          >
            <path
              css={`
                stroke: transparent;
                stroke-width: 4;
                fill: none;
                pointer-events: visiblePainted;
                shape-rendering: optimizeSpeed;
              `}
              style={{
                stroke:
                  // prettier-ignore
                  object.uid === hoveredObjectUid ? ' #4e7fff'
                          : object.brush != null ? 'transparent'
                          : 'none',
                fill: object.fill != null ? 'transparent' : 'none',
                transform: `matrix(${object.matrix.join(',')})`,
              }}
              d={object.path.svgPath}
              onClick={handleClickObjectOutline}
              data-object-uid={object.uid}
              {...bindObjectHover()}
              {...bindObjectDrag()}
            />
          </g>
        </>
      ))}

      {activeObject && (
        <g
          data-devmemo="Active object controls"
          style={{
            transform: `translate(${activeObject.x}, ${
              activeObject.y
            }) matrix(${activeObject.matrix.join(',')})`,
          }}
        >
          <PathSegments
            object={activeObject}
            scale={canvasScale}
            // isHoverOnPath={isHoverOnPath}
            // hoverObjectId={hoveredObjectUid}
            onClickPath={handleClickPath}
            onDoubleClickPath={handleDoubleClickPath}
            onHoverStateChange={handleHoverChangePath}
            showPaths={true}
            showPoints={currentTool === 'point-cursor'}
            showControls={currentTool === 'point-cursor'}
          />

          {currentTool !== 'point-cursor' && (
            <ObjectBoundingBox
              object={activeObject}
              active={true}
              scale={canvasScale}
            />
          )}
          {currentTool === 'point-cursor' &&
            activeObject?.fill?.type === 'linear-gradient' && (
              <GradientControl object={activeObject} scale={canvasScale} />
            )}
        </g>
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
  const objectBBox = useMemo(
    () => object?.getBoundingBox(),
    [object.lastUpdatedAt]
  )

  if (object?.fill?.type !== 'linear-gradient') return null

  const defId = `silk-ui-linear-gradient-${object.uid}`
  const { start, end } = object.fill
  const distance = { x: end.x - start.x, y: end.y - start.y }

  return (
    <>
      <defs>
        <linearGradient id={defId}>
          {object.fill.colorStops.map(({ color, position }) => (
            <stop
              offset={`${position * 100}%`}
              stopColor={rgba(...normalRgbToRgbArray(color), color.a)}
            />
          ))}
        </linearGradient>
      </defs>

      <g>
        <line
          css={`
            filter: drop-shadow(0 0 4px ${rgba('#000', 0.2)});
            pointer-events: none;
          `}
          x1={objectBBox?.centerX + object.fill.start.x}
          y1={objectBBox?.centerY + object.fill.start.y}
          x2={objectBBox?.centerX + object.fill.end.x}
          y2={objectBBox?.centerY + object.fill.end.y}
          stroke="#fff"
          strokeWidth={6 * zoom}
          strokeLinecap="round"
        />
        <line
          css={`
            pointer-events: none;
          `}
          x1={objectBBox?.centerX + object.fill.start.x}
          y1={objectBBox?.centerY + object.fill.start.y}
          x2={objectBBox?.centerX + object.fill.end.x}
          y2={objectBBox?.centerY + object.fill.end.y}
          stroke={`url(#${defId})`}
          strokeWidth={4 * zoom}
          strokeLinecap="round"
        />

        {object.fill.colorStops.map((stop) => (
          <circle
            r={4 * zoom}
            fill={rgba(...normalRgbToRgbArray(stop.color), stop.color.a)}
            stroke="#fff"
            cx={objectBBox?.centerX + start.x + distance.y * stop.position}
            cy={objectBBox?.centerY + start.y + distance.y * stop.position}
          />
        ))}
      </g>
    </>
  )
}

const PathSegments = ({
  object,
  scale,
  // isHoverOnPath,
  // hoverObjectId,
  onClickPath,
  onDoubleClickPath,
  onHoverStateChange,
  showPaths,
  showPoints,
  showControls,
}: {
  object: SilkDOM.VectorObject
  scale: number
  // isHoverOnPath: boolean
  // hoverObjectId: string | null
  onClickPath: (objectId: string) => void
  onDoubleClickPath: (
    objectId: string,
    segmentIndex: number,
    point: { x: number; y: number }
  ) => void
  onHoverStateChange: (e: { hovering: boolean; objectId: string }) => void
  showPaths: boolean
  showPoints: boolean
  showControls: boolean
}) => {
  const { executeOperation } = useFleurContext()
  const {
    activeLayer,
    activeLayerPath,
    activeObject,
    currentTool,
    vectorStroking,
    activeObjectPointIndices,
    canvasScale,
    lastUpdated,
  } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    activeLayerPath: EditorSelector.activeLayerPath(get),
    activeObject: EditorSelector.activeObject(get),
    currentTool: get(EditorStore).state.currentTool,
    vectorStroking: get(EditorStore).state.vectorStroking,
    currentStroke: get(EditorStore).state.currentStroke,
    currentFill: get(EditorStore).state.currentFill,
    activeObjectPointIndices: get(EditorStore).state.activeObjectPointIndices,
    canvasScale: EditorSelector.canvasScale(get),

    // Get for rerender on update
    lastUpdated: get(EditorStore).state.vectorLastUpdated,
  }))

  if (activeLayer?.layerType !== 'vector')
    throw new Error('Invalid layerType in PathSegment component')

  const bindDragStartInAnchor = useDrag(({ delta, event }) => {
    event.stopPropagation()

    const { dataset } = event.currentTarget as SVGCircleElement
    const pointIndex = +dataset.pointIndex!

    executeOperation(EditorOps.updateVectorLayer, activeLayerPath, (layer) => {
      object.update((o) => {
        const point = object.path.points[pointIndex]
        if (!point?.in) return

        point.in.x += delta[0] * (1 / scale)
        point.in.y += delta[1] * (1 / scale)
      })
    })
  })

  const bindDragOutAnchor = useDrag(({ delta, event }) => {
    event.stopPropagation()

    const { dataset } = event.currentTarget as SVGCircleElement
    const pointIndex = +dataset.pointIndex!

    executeOperation(EditorOps.updateVectorLayer, activeLayerPath, (layer) => {
      object.update((o) => {
        const point = o.path.points[pointIndex]
        if (!point?.out) return

        point.out.x += delta[0] * (1 / scale)
        point.out.y += delta[1] * (1 / scale)
      })
    })
  })

  const bindDragPoint = useDrag(({ delta, event, first, last }) => {
    event.stopPropagation()

    const { dataset } = event.currentTarget as SVGElement
    const pointIndex = +dataset.pointIndex!

    executeOperation(EditorOps.updateVectorLayer, activeLayerPath, (layer) => {
      if (first) {
        // Unfreeze path for faster processing
        object.path = object.path.clone()
      }

      const point = object.path.points[pointIndex]
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

      if (last) {
        object.path.freeze()
      }
    })
  })

  const handleClickPoint = useFunk((e: MouseEvent<SVGRectElement>) => {
    e.stopPropagation()

    const { dataset } = e.currentTarget
    const pointIndex = +dataset.pointIndex!
    const isFirstSegment = dataset.isFirstSegment != null
    const isLastSegment = dataset.isLastSegment != null

    if (vectorStroking && (isLastSegment || isFirstSegment)) {
      if (!activeLayer || !activeObject) return
      if (vectorStroking.objectId !== object.uid) return
      if (!vectorStroking.isTail && !vectorStroking.isHead) return

      executeOperation(
        EditorOps.updateVectorLayer,
        activeLayerPath,
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
      executeOperation(EditorOps.setVectorStroking, {
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

    executeOperation(EditorOps.setSelectedObjectPoints, nextIndices)
  })

  const handleClickPath = useFunk((e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()

    const { dataset } = e.currentTarget
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

      executeOperation(EditorOps.addPoint, object, pointIndex, {
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

      executeOperation(EditorOps.updateActiveObject, (object) => {
        object.path.points[pointIndex].in = null
      })
    }
  )

  const handleDoubleClickOutPoint = useFunk(
    (e: MouseEvent<SVGCircleElement>) => {
      const { dataset } = e.currentTarget
      const pointIndex = +dataset.pointIndex!

      executeOperation(EditorOps.updateActiveObject, (object) => {
        object.path.points[pointIndex].out = null
      })
    }
  )

  // const pathHoverBind = useHover((e) => {
  //   const { dataset } = e.event.currentTarget as any as SVGPathElement
  //   const object = objects.find((obj) => obj.uid === dataset.objectId!)!

  //   onHoverStateChange({ hovering: e.hovering, objectId: object.uid })
  // })

  const zoom = Math.max(1 / scale, 1)

  const pathSegments = useMemo(() => {
    return object.path
      .mapPoints((point, prevPoint, pointIdx, points) => {
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
        // const hovering = isHoverOnPath && object.uid === hoverObjectId
        const renderPoint =
          pointIdx !== points.length - 1 || !object.path.closed

        return {
          object,
          line: (
            <Fragment key={`path-${object.uid}`}>
              <path
                css={`
                  stroke: transparent;
                  stroke-width: 2;
                  fill: none;
                  pointer-events: none;
                  shape-rendering: optimizeSpeed;
                `}
                style={{
                  ...(isActive ? { stroke: '#4e7fff' } : {}),
                }}
                d={segmentPath}
                data-object-id={object.uid}
              />

              {/* <path
                // 当たり判定ブチ上げくん
                css={`
                  stroke: transparent;
                  fill: none;
                  pointer-events: visiblePainted;
                  stroke: transparent;
                  shape-rendering: optimizeSpeed;
                `}
                data-devmemo="DragControl"
                style={{
                  strokeWidth: POINT_SIZE * zoom,
                  // fill: object.fill ? 'transparent' : 'none',
                }}
                d={segmentPath}
                data-object-id={object.uid}
                data-point-index={pointIdx}
                onClick={handleClickPath}
                onDoubleClick={handleDoubleClickPath}
                // {...pathHoverBind()}
                // {...bindObjectDrag()}
              /> */}
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
                            shape-rendering: optimizeSpeed;
                          `}
                          style={{ strokeWidth: 0.5 * zoom }}
                          points={`${point.in.x},${point.in.y} ${point.x},${point.y}`}
                        />
                        <circle
                          css={`
                            fill: #4e7fff;
                            stroke: rgba(0, 0, 0, 0.2);
                            pointer-events: visiblePainted;
                            shape-rendering: optimizeSpeed;
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
                      shape-rendering: optimizeSpeed;
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
                      shape-rendering: optimizeSpeed;
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
                    shape-rendering: optimizeSpeed;
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
      .flat(1)
  }, [activeObject?.uid, object, lastUpdated])

  return (
    <>
      {pathSegments.map(({ line, inControl, outControl, object }, idx) => (
        <Fragment key={`segment-${idx}-${object.uid}`}>
          <g
            data-devmemo="PathSegment"
            style={{ transform: `matrix(${object.matrix.join(',')})` }}
          >
            {showPaths && line}
            {showControls && inControl}
            {outControl && outControl}
          </g>
        </Fragment>
      ))}
      {pathSegments.map(({ point, object }, idx) => (
        <g
          data-devmemo="PathSegment-points"
          key={`point-seg-${idx}-${object.uid}]`}
          style={{ transform: `matrix(${object.matrix.join(',')})` }}
        >
          {showPoints && point}
        </g>
      ))}
    </>
  )
}

const ObjectBoundingBox = ({
  object,
  scale,
  active,
  ...etc
}: {
  object: SilkDOM.VectorObject
  scale: number
  active: boolean
}) => {
  const { execute } = useFleur()
  const bbox = useMemo(() => object.getBoundingBox(), [object.lastUpdatedAt])
  const rotateRef = useRef(object.rotate)

  const [dragPoint, setDragPoint] = useState<[number, number] | null>(null)

  const zoom = 1 / scale
  const controlSize = POINT_SIZE * zoom

  const bindLeftTopDrag = useDrag((e) => {
    const { initial, xy, last } = e

    e.memo ??= { rotate: object.rotate }

    const svg = (e.event.target as SVGElement).closest('svg')!

    const xyIni = assign(svg.createSVGPoint(), {
      x: initial[0],
      y: initial[1],
    }).matrixTransform(svg.getScreenCTM()!.inverse())

    const xyPt = assign(svg.createSVGPoint(), {
      x: xy[0],
      y: xy[1],
    }).matrixTransform(svg.getScreenCTM()!.inverse())

    const { x, y } = xyPt

    setDragPoint([x, y])

    execute(EditorOps.updateActiveObject, (o) => {
      const bbox = o.getBoundingBox()

      const angle = SilkWebMath.angleOfPoints(
        { x: bbox.centerX, y: bbox.centerY },
        { x: x - xyIni.x, y: y - xyIni.y }
      )

      o.rotate = e.memo!.rotate - SilkWebMath.radToDeg(angle)
      // o.x += delta[0] * zoom
      // o.y += delta[1] * zoom
    })

    if (last) {
      setDragPoint(null)
    }

    return e.memo
  })

  return (
    <g data-devmemo="Bounding box" style={{}}>
      <rect
        css={`
          fill: none;
          pointer-events: stroke;
          shape-rendering: optimizeSpeed;
        `}
        // x={bbox.left}
        // y={bbox.top}
        width={bbox.width}
        height={bbox.height}
        style={{
          strokeWidth: 1 * zoom,
          // transform: `translate(${object.x}, ${object.y})`,
          transform: `matrix(${object.matrix.join(',')})`,
          ...(active ? { stroke: '#4e7fff' } : {}),
        }}
        {...etc}
      />

      {dragPoint && (
        <line
          x1={bbox.centerX}
          y1={bbox.centerY}
          x2={dragPoint[0]}
          y2={dragPoint[1]}
        />
      )}

      <circle
        cx={bbox.centerX}
        cy={bbox.centerY - bbox.height / 2 - 24}
        stroke="#4e7fff"
        strokeWidth={2 * zoom}
        r={8 * zoom}
        {...bindLeftTopDrag()}
      />

      <rect
        css={`
          ${anchorRect}
          shape-rendering: optimizeSpeed;
        `}
        x={bbox.left}
        y={bbox.top}
        width={controlSize}
        height={controlSize}
        style={{
          stroke: '#4e7fff',
          fill: '#fff',
          strokeWidth: 1 * zoom,
          transform: `translate(${-controlSize / 2}px, ${-controlSize / 2}px)`,
        }}
      />
      <rect
        css={`
          ${anchorRect}
          shape-rendering: optimizeSpeed;
        `}
        x={bbox.right}
        y={bbox.top}
        width={controlSize}
        height={controlSize}
        style={{
          strokeWidth: 1 * zoom,
          transform: `translate(${-controlSize / 2}px, ${-controlSize / 2}px)`,
        }}
      />
      <rect
        css={`
          ${anchorRect}
          shape-rendering: optimizeSpeed;
        `}
        x={bbox.left}
        y={bbox.bottom}
        width={controlSize}
        height={controlSize}
        style={{
          strokeWidth: 1 * zoom,
          transform: `translate(${-controlSize / 2}px, ${-controlSize / 2}px)`,
        }}
      />
      <rect
        css={`
          ${anchorRect}
          shape-rendering: optimizeSpeed;
        `}
        x={bbox.right}
        y={bbox.bottom}
        width={controlSize}
        height={controlSize}
        style={{
          strokeWidth: 1 * zoom,
          transform: `translate(${-controlSize / 2}px, ${-controlSize / 2}px)`,
        }}
      />
    </g>
  )
}

const anchorRect = css`
  stroke: #4e7fff;
  fill: #fff;
`

function assertVectorLayer(layer: any): asserts layer is SilkDOM.VectorLayer {
  if (layer?.layerType !== 'vector')
    throw new Error('Expect VectorLayer but RasterLayer given')
}

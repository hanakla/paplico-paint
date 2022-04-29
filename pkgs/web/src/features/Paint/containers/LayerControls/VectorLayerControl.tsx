import { useFleurContext, useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import {
  Fragment,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useClickAway, useToggle } from 'react-use'
import { useDrag, useHover } from 'react-use-gesture'
import { PapCommands, PapDOM } from '@paplico/core'
import { rgba } from 'polished'
import { useTranslation } from 'next-i18next'
import { DragMove2 } from '@styled-icons/remix-fill'
import { css } from 'styled-components'

import { the } from '🙌/utils/anyOf'
import { PapWebMath } from '🙌/utils/PapWebMath'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunkyMouseTrap } from '🙌/hooks/useMouseTrap'
import { assign } from '🙌/utils/object'
import { deepClone } from '🙌/utils/clone'
import { normalRgbToRgbArray } from '../../helpers'
import { useFleur } from '🙌/utils/hooks'
import { DOMUtils } from '🙌/utils/dom'
import {
  useLayerWatch,
  useVectorObjectWatch,
  usePaintCanvasRef,
  useTransactionCommand,
} from '../../hooks'
import { Portal } from '🙌/components/Portal'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuParam,
  useContextMenu,
} from '🙌/components/ContextMenu'
import { tm } from '🙌/utils/theme'
import { floatingDropShadow } from '🙌/utils/mixins'

const POINT_SIZE = 8

// const VectorEditorSelector = {
//   // isDiplayPointForObject: selector([EditorSelector.currentTool], (tool) => tool)
// }

export const VectorLayerControl = () => {
  const { t } = useTranslation('app')
  const { executeOperation } = useFleurContext()
  const { execute, getStore } = useFleur()

  const {
    engine,
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
    engine: get(EditorStore).state.engine,
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

  const contextMenu = useContextMenu()
  const trsnCommand = useTransactionCommand()

  const canvasRef = usePaintCanvasRef()
  const rootRef = useRef<SVGSVGElement | null>(null)
  const makePathTransactionRef = useRef<PapCommands.Transaction | null>(null)

  if (!activeLayer || activeLayer.layerType !== 'vector') throw new Error('')

  const [isHoverOnPath, toggleIsHoverOnPath] = useToggle(false)
  const [hoveredObjectUid, setHoveredObjectUid] = useState<string | null>(null)
  const currentControllDirection = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })

  const handleClickRoot = useFunk((e: MouseEvent<SVGRectElement>) => {
    if (currentTool === 'shape-pen') return
    if (!DOMUtils.isSameElement(e.target, e.currentTarget)) return
    execute(EditorOps.setActiveObject, null)
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
      if (!activeLayerPath) return

      // Insert point to current path
      // SEE: http://polymathprogrammer.com/2007/06/27/reverse-engineering-bezier-curves/
      executeOperation(
        EditorOps.runCommand,
        new PapCommands.VectorLayer.PatchPathPoints({
          pathToTargetLayer: activeLayerPath,
          objectUid: objectId,
          patcher: (points) => {
            points.splice(segmentIndex, 0, {
              x,
              y,
              in: { x: x + 2, y: y - 2 },
              out: { x: x - 2, y: y + 2 },
            })
          },
        })
      )
    }
  )

  const handleClickObjectOutline = useFunk((e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()

    execute(
      EditorOps.setActiveObject,
      e.currentTarget.dataset.objectUid ?? null
    )
  })

  const bindRootDrag = useDrag(
    ({ initial, first, last, xy, event: e }) => {
      assertVectorLayer(activeLayer)

      if (currentTool !== 'shape-pen' || !activeLayerPath) return

      // Add point
      // SEE: https://stackoverflow.com/a/42711775
      const svg = (e.currentTarget as SVGRectElement).ownerSVGElement!
      const initialPt = DOMUtils.domPointToSvgPoint(svg, {
        x: initial[0],
        y: initial[1],
      })
      const { x, y } = DOMUtils.domPointToSvgPoint(svg, {
        x: xy[0],
        y: xy[1],
      })

      if (last) {
        trsnCommand.commit()
        return
      }

      if (first) {
        // Create new Object and add point
        const newPoint: PapDOM.Path.PathPoint = {
          in: null,
          out: null,
          x,
          y,
          pressure: 1,
        }

        trsnCommand.startIfNotStarted()

        let nextPointIndex: number = -1
        let nextObjectId: string = ''

        if (vectorStroking == null) {
          // Create new object with point
          if (!activeLayerPath) return

          // When click clear space, add new VectorObject
          const object = PapDOM.VectorObject.create({
            x: 0,
            y: 0,
            path: PapDOM.Path.create({
              points: [newPoint],
              closed: false,
            }),
            brush: currentStroke ? deepClone(currentStroke) : null,
            fill: currentFill ? deepClone(currentFill) : null,
          })

          trsnCommand.doAndAdd(
            new PapCommands.VectorLayer.AddObject({
              object,
              pathToTargetLayer: activeLayerPath,
            })
          )

          nextObjectId = object.uid
          execute(EditorOps.setActiveObject, object.uid)
          execute(EditorOps.setSelectedObjectPoints, [0])
          execute(EditorOps.markVectorLastUpdate)
          nextPointIndex = 0
        } else {
          if (!activeLayerPath) return

          // Add point to active path
          nextObjectId = vectorStroking.objectId

          trsnCommand.doAndAdd(
            new PapCommands.VectorLayer.PatchPathPoints({
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

          execute(EditorOps.markVectorLastUpdate)
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
          new PapCommands.VectorLayer.PatchPathPoints({
            pathToTargetLayer: activeLayerPath,
            objectUid: vectorStroking.objectId,
            patcher: (points) => {
              const targetPointIndex = vectorStroking.selectedPointIndex
              const point = points[targetPointIndex]
              if (!point) return

              // SEE: https://qiita.com/Hoshi_7/items/d04936883ff3eb1eed2d
              const distance = Math.hypot(x - initialPt.x, y - initialPt.y)

              const rad = Math.atan2(y - initialPt.y, x - initialPt.x)
              const degree = PapWebMath.normalizeDegree((rad * 180) / Math.PI)

              const oppeseDegree = PapWebMath.normalizeDegree(degree + 180)
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

        execute(EditorOps.markVectorLastUpdate)

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
          new PapCommands.VectorLayer.TransformObject({
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

  const handleContextMenu = useFunk((e: MouseEvent) => {
    contextMenu.show(e, {
      props: {
        objectUid: (e.currentTarget as SVGPathElement).dataset!.objectUid,
      },
    })
  })

  const handleClickMoveUp = useFunk(
    (e: ContextMenuParam<{ objectUid: string }>) => {
      if (!activeLayerPath) return

      execute(
        EditorOps.runCommand,
        new PapCommands.VectorLayer.ReorderObjects({
          pathToTargetLayer: activeLayerPath,
          objectUid: e.props!.objectUid,
          newIndex: { delta: 1 },
        })
      )
    }
  )

  const handleClickMoveDown = useFunk(
    (e: ContextMenuParam<{ objectUid: string }>) => {
      if (!activeLayerPath) return

      execute(
        EditorOps.runCommand,
        new PapCommands.VectorLayer.ReorderObjects({
          pathToTargetLayer: activeLayerPath,
          objectUid: e.props!.objectUid,
          newIndex: { delta: -1 },
        })
      )
    }
  )

  useClickAway(rootRef as any, (e) => {
    // if (isEventIgnoringTarget(e.target)) return
    execute(EditorOps.setVectorStroking, null)
    execute(EditorOps.setSelectedObjectPoints, [])
  })

  useFunkyMouseTrap(rootRef, ['del', 'backspace'], () => {
    if (!activeLayerPath) return
    if (activeObjectId == null) return

    if (activeObjectPointIndices.length === 0) {
      execute(
        EditorOps.runCommand,
        new PapCommands.VectorLayer.DeleteObject({
          pathToTargetLayer: activeLayerPath,
          objectUid: activeObjectId,
        })
      )
    } else {
      execute(EditorOps.deleteSelectedObjectPoints)
    }
  })

  useFunkyMouseTrap(rootRef, ['command+c', 'ctrl+c'], () => {
    if (!activeLayerPath) return
    if (activeObjectId == null) return

    // execute(ClipboardOps.copyObject, )
  })

  const bindControllerDrag = useDrag((e) => {
    if (!activeLayerPath) return

    if (e.first) {
      trsnCommand.startIfNotStarted()
    }

    currentControllDirection.current = {
      x: PapWebMath.clamp((e.xy[0] - e.initial[0]) / 2, -10, 10),
      y: PapWebMath.clamp((e.xy[1] - e.initial[1]) / 2, -10, 10),
    }

    if (e.last) {
      currentControllDirection.current = { x: 0, y: 0 }
      trsnCommand.commit()
    }
  })

  // Apply delta each frame for transform controller
  useEffect(() => {
    if (!activeLayerPath || !activeObject || !activeObjectId) return

    const id = window.setInterval(() => {
      if (!trsnCommand.isStarted) return

      trsnCommand.doAndAdd(
        new PapCommands.VectorLayer.TransformObject({
          pathToTargetLayer: activeLayerPath,
          objectUid: activeObjectId,
          transform: {
            movement: {
              x: currentControllDirection.current.x,
              y: currentControllDirection.current.y,
            },
          },
          skipDo: false,
        })
      )

      execute(EditorOps.rerenderCanvas)
    }, 100)

    return () => window.clearInterval(id)
  }, [activeLayerPath, activeObject, activeObjectId])

  useLayerWatch(activeLayer)

  if (!currentDocument) return null
  if (!activeLayer.visible || activeLayer.lock) return null

  const skipHoverEffect =
    vectorStroking || the(currentTool).in('draw', 'erase', 'shape-pen')

  // MEMO: これ見て https://codepen.io/osublake/pen/ggYxvp
  return (
    <svg
      data-devmemo="Vector layer control"
      ref={rootRef}
      css={`
        fill: transparent;
        outline: none;
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
      tabIndex={-1}
      overflow="visible"
    >
      <rect
        width={currentDocument.width}
        height={currentDocument.height}
        x={0}
        y={0}
        onClick={handleClickRoot}
        {...bindRootDrag()}
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
                pointer-events: none;
                shape-rendering: optimizeSpeed;
              `}
              style={{
                stroke:
                  // prettier-ignore
                  object.uid === hoveredObjectUid ? ' #4e7fff'
                    : object.brush == null && object.fill == null ? 'transparent'
                    : object.brush != null ? 'transparent'
                    : 'none',
                fill: object.fill != null ? 'transparent' : 'none',
                transform: `matrix(${object.matrix.join(',')})`,
                pointerEvents: skipHoverEffect ? 'none' : undefined,
              }}
              d={object.path.svgPath}
            />
            <path
              css={`
                stroke: transparent;
                stroke-width: 8;
                fill: none;
                pointer-events: visiblePainted;
                shape-rendering: optimizeSpeed;

                &:hover {
                  cursor: move;
                }
              `}
              style={{
                stroke:
                  // prettier-ignore
                  object.brush == null && object.fill == null ? 'transparent'
                    : object.brush != null ? 'transparent'
                    : 'none',
                fill: object.fill != null ? 'transparent' : 'none',
                transform: `matrix(${object.matrix.join(',')})`,
                // prettier-ignore
                pointerEvents:
                  vectorStroking?.objectId === object.uid ? undefined
                  : skipHoverEffect ? 'none'
                  : undefined,
              }}
              d={object.path.svgPath}
              onClick={handleClickObjectOutline}
              data-object-uid={object.uid}
              onContextMenu={handleContextMenu}
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
            showPoints={the(currentTool).in('point-cursor', 'shape-pen')}
            showControls={the(currentTool).in('point-cursor', 'shape-pen')}
          />

          {currentTool === 'cursor' && (
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

      <Portal>
        <ContextMenu id={contextMenu.id}>
          <ContextMenuItem onClick={handleClickMoveUp}>
            {t('vectorControl.context.moveup')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleClickMoveDown}>
            {t('vectorControl.context.movedown')}
          </ContextMenuItem>
        </ContextMenu>
      </Portal>

      <Portal>
        <div
          css={`
            position: fixed;
            bottom: 96px;
            left: 50%;
            padding: 4px;
            transform: translateX(-50%);
            border-radius: 100px;
            transition: 0.2 ease-in-out;
            transition-property: transform, opacity;
            ${floatingDropShadow}
            ${tm((o) => [o.bg.surface1])}
          `}
          style={{
            transform: `translate(calc(-50% + ${currentControllDirection.current.x}px), ${currentControllDirection.current.y}px)`,
            ...(activeObject
              ? { opacity: 1, pointerEvents: 'all' }
              : { opacity: 0.0, pointerEvents: 'none' }),
          }}
          {...bindControllerDrag()}
        >
          <DragMove2
            css={`
              ${tm((o) => [o.font.text2])}
            `}
            width={32}
          />
        </div>
      </Portal>
    </svg>
  )
}

const GradientControl = ({
  object,
  scale,
}: {
  object: PapDOM.VectorObject
  scale: number
}) => {
  const zoom = 1 / scale
  const objectBBox = useMemo(
    () => object?.getBoundingBox(),
    [object.lastUpdatedAt]
  )

  if (object?.fill?.type !== 'linear-gradient') return null

  const defId = `pplc-ui-linear-gradient-${object.uid}`
  const { start, end } = object.fill
  const distance = { x: end.x - start.x, y: end.y - start.y }

  useVectorObjectWatch(object)

  return (
    <>
      <defs>
        <linearGradient
          id={defId}
          x1={objectBBox?.centerX + start.x + distance.x}
          y1={objectBBox?.centerY + start.y + distance.y}
          x2={objectBBox?.centerX + end.x + distance.x}
          y2={objectBBox?.centerY + end.y + distance.y}
        >
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

        {object.fill.colorStops.map((stop, idx) => (
          <circle
            key={idx}
            r={4 * zoom}
            fill={rgba(...normalRgbToRgbArray(stop.color), stop.color.a)}
            stroke="#fff"
            cx={objectBBox?.centerX + start.x + distance.x * stop.position}
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
  object: PapDOM.VectorObject
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
  const { t } = useTranslation('app')
  const { executeOperation } = useFleurContext()
  const { execute } = useFleur()
  const {
    activeLayer,
    activeLayerPath,
    activeObject,
    currentTool,
    vectorStroking,
    activeObjectPointIndices,
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

    // Get for rerender on update
    lastUpdated: get(EditorStore).state.vectorLastUpdated,
  }))

  if (activeLayer?.layerType !== 'vector')
    throw new Error('Invalid layerType in PathSegment component')

  useVectorObjectWatch(object)

  const contextMenu = useContextMenu()

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

    if (!activeLayerPath) return

    execute(
      EditorOps.runCommand,
      new PapCommands.VectorLayer.PatchPathPoints({
        pathToTargetLayer: activeLayerPath,
        objectUid: object.uid,
        patcher: (points) => {
          const point = points[pointIndex]
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
        },
      })
    )

    execute(EditorOps.markVectorLastUpdate)
  })

  const handleClickPoint = useFunk((e: MouseEvent<SVGRectElement>) => {
    e.stopPropagation()

    const { dataset } = e.currentTarget
    const pointIndex = +dataset.pointIndex!
    const isFirstPoint = dataset.isFairstPoint != null
    const isLastPoint = dataset.isLastPoint != null

    if (currentTool !== 'shape-pen') return
    if (!activeLayerPath) return

    if (vectorStroking && (isLastPoint || isFirstPoint)) {
      if (!activeLayer || !activeObject) return
      if (vectorStroking.objectId !== object.uid) return
      if (!vectorStroking.isTail && !vectorStroking.isHead) return

      execute(
        EditorOps.runCommand,
        new PapCommands.VectorLayer.PatchPathAttr({
          pathToTargetLayer: activeLayerPath,
          objectUid: vectorStroking.objectId,
          patch: { closed: true },
        })
      )

      return
    }

    if (activeObject && (isLastPoint || isFirstPoint)) {
      execute(EditorOps.setVectorStroking, {
        objectId: object.uid,
        selectedPointIndex: pointIndex,
        isHead: isFirstPoint,
        isTail: isLastPoint,
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

      const angle = PapWebMath.angleOfPoints(prevPoint, point)
      const reverseAngle = PapWebMath.degToRad(
        PapWebMath.deg(PapWebMath.radToDeg(angle) + 180)
      )
      const distance = PapWebMath.distanceOfPoint(prevPoint, point)

      executeOperation(EditorOps.addPoint, object, pointIndex, {
        x: pt.x,
        y: pt.y,
        in: PapWebMath.pointByAngleAndDistance({
          angle: reverseAngle,
          distance: distance / 2,
          base: pt,
        }),
        out: PapWebMath.pointByAngleAndDistance({
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
    const cursorPt = DOMUtils.domPointToSvgPoint(svg, {
      x: e.clientX,
      y: e.clientY,
    })
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
        const isActive = activeObject?.uid === object.uid
        const isPointSelected = activeObjectPointIndices.includes(pointIdx)
        const isFirstPoint = pointIdx === 0
        const isLastPoint = pointIdx === points.length - 1
        // const hovering = isHoverOnPath && object.uid === hoverObjectId
        const renderPoint =
          pointIdx !== points.length - 1 || !object.path.closed

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
                onDoubleClick={handleDoubleClickPath}
              />
            </Fragment>
          ),

          inControl: (
            <Fragment key={`inControl-${object.uid}`}>
              {isActive &&
                isPointSelected &&
                !(object.path.closed && isLastPoint) && (
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
                    r={POINT_SIZE} //  * zoom
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
                  data-is-first-point={isFirstPoint ? true : null}
                  data-is-last-point={isLastPoint ? true : null}
                  onClick={handleClickPoint}
                  {...bindDragPoint()}
                />
              </Fragment>
            ),
        }
      })
      .flat(1)
  }, [activeObject?.uid, object, object.path.points.length, lastUpdated])

  const elements = (
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

  return elements
}

const ObjectBoundingBox = ({
  object,
  scale,
  active,
  ...etc
}: {
  object: PapDOM.VectorObject
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

      const angle = PapWebMath.angleOfPoints(
        { x: bbox.centerX, y: bbox.centerY },
        { x: x - xyIni.x, y: y - xyIni.y }
      )

      o.rotate = e.memo!.rotate - PapWebMath.radToDeg(angle)
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

          &:hover {
            cursor: move;
          }
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

function assertVectorLayer(layer: any): asserts layer is PapDOM.VectorLayer {
  if (layer?.layerType !== 'vector')
    throw new Error('Expect VectorLayer but RasterLayer given')
}

import { useEditorStore, useEngineStore } from '@/store'
import { ToolModes } from '@/stores/types'
import { usePointerDrag } from '@/utils/hooks'
import { Commands, PaplicoMath } from '@paplico/core-new'
import { VisuElement as VisuElementType } from '@paplico/core-new/dist/Document'
import {
  KeyboardEvent,
  ReactNode,
  SVGProps,
  memo,
  useEffect,
  useReducer,
  useState,
} from 'react'
import { unstable_batchedUpdates } from 'react-dom'
import { createUseStyles } from 'react-jss'
import useEvent from 'react-use-event-hook'
import { VectorObjectElement } from './VisuElement.VectorObject'
import { storePicker } from '@/utils/zustand'
import { mapEntries } from '@paplico/shared-lib'

const RECT_SIZE = 10
const HALF_OF_RECT_SIZE = RECT_SIZE / 2

type Props = {
  visu:
    | VisuElementType.FilterElement
    | VisuElementType.GroupElement
    | VisuElementType.CanvasElement
    | VisuElementType.ImageReferenceElement
    | VisuElementType.TextElement
    | VisuElementType.VectorObjectElement
  layerNodePath: string[]
  canVisible: boolean
  isLocked: boolean
}

export const VisuElement = memo(function VisuElement(props: Props) {
  if (!props.canVisible || props.isLocked) return null

  return <VisuElementInternal {...props} />
})

const VisuElementInternal = memo(function VisuElementInternal({
  visu,
  layerNodePath,
}: Props) {
  const editor = useEditorStore(
    storePicker([
      'toolMode',
      'selectedVisuUidMap',
      'canvasScale',
      'visuTransformOverride',
      'setVisuTransformOverride',
    ]),
  )

  const { paplico } = useEngineStore()
  const s = usePathStyle()
  const rerender = useReducer((s) => s + 1, 0)[1]

  const isEditableToolMode =
    editor.toolMode === ToolModes.objectTool ||
    editor.toolMode === ToolModes.curveTool
  const elementScale = 1 / editor.canvasScale

  console.log(editor.toolMode)

  const bindDrag = usePointerDrag(
    async ({ movement, offsetMovement, last, event }) => {
      if (editor.toolMode !== ToolModes.objectTool) return
      if (PaplicoMath.distance2D(0, 0, movement[0], movement[1]) < 4) return
      if (!editor.selectedVisuUidMap[visu.uid]) return

      event.stopPropagation()

      if (!last) {
        editor.setVisuTransformOverride((prev) => ({
          ...prev,
          position: {
            x: offsetMovement[0] / elementScale,
            y: offsetMovement[1] / elementScale,
          },
        }))

        paplico.requestPreviewPriolityRerender({
          transformOverrides: Object.fromEntries(
            mapEntries(editor.selectedVisuUidMap, ([uid]) => {
              return [
                uid,
                (base) => {
                  base.transform.position.x += offsetMovement[0] / elementScale
                  base.transform.position.y += offsetMovement[1] / elementScale
                  return base
                },
              ]
            }),
          ),
        })
      } else {
        const command = new Commands.CommandGroup(
          mapEntries(editor.selectedVisuUidMap, ([uid]) => {
            return new Commands.VisuUpdateAttributes(uid, {
              updater: (target) => {
                target.transform.position = {
                  x:
                    target.transform.position.x +
                    offsetMovement[0] / elementScale,
                  y:
                    target.transform.position.y +
                    offsetMovement[1] / elementScale,
                }
              },
            })
          }),
        )

        await paplico.command.do(command)

        editor.setVisuTransformOverride(null)
      }
    },
  )

  const handleKeyDown = useEvent((e: KeyboardEvent<SVGElement>) => {
    if (editor.toolMode !== ToolModes.objectTool) return

    e.stopPropagation()

    if (e.key === 'Delete' || e.key === 'Backspace') {
      paplico.command.do(
        new Commands.DocumentManipulateLayerNodes({
          remove: [layerNodePath],
        }),
      )
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const amount = (e.key === 'ArrowUp' ? -1 : 1) * (e.shiftKey ? 10 : 1)

      paplico.command.do(
        new Commands.VisuUpdateAttributes(visu.uid, {
          updater: (target) => {
            target.transform.position.y += amount
          },
        }),
      )
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const amount = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1)

      paplico.command.do(
        new Commands.VisuUpdateAttributes(visu.uid, {
          updater: (target) => {
            target.transform.position.x += amount
          },
        }),
      )
    }
  })

  useEffect(() => {
    const offs = [
      paplico.on('document:layerUpdated', ({ layerEntityUid }) => {
        if (layerEntityUid !== visu.uid) return

        unstable_batchedUpdates(() => {
          // revalidatePathElement()
          // revalidateDetailElements()
        })
      }),
      paplico.on('document:metrics:update', ({ updatedVisuUids }) => {
        if (updatedVisuUids.includes(visu.uid)) {
          rerender()
        }
      }),
    ]

    return () => {
      offs.forEach((off) => off())
    }
  })

  const elements = (() => {
    if (!isEditableToolMode) return null

    const metrics = paplico.visuMetrics?.getLayerMetrics(visu.uid)
    if (!metrics) return null

    const override = editor.selectedVisuUidMap[visu.uid]
      ? editor.visuTransformOverride
      : null

    const left = metrics.originalBBox.left + (override?.position.x ?? 0)
    const top = metrics.originalBBox.top + (override?.position.y ?? 0)
    const right = metrics.originalBBox.right + (override?.position.x ?? 0)
    const bottom = metrics.originalBBox.bottom + (override?.position.y ?? 0)

    return [
      <rect
        key="bbox"
        className={s.bbox}
        x={left}
        y={top}
        width={metrics.originalBBox.width}
        height={metrics.originalBBox.height}
        {...bindDrag()}
      />,
      <rect
        key="left-top"
        className={s.controlPoint}
        x={left - HALF_OF_RECT_SIZE}
        y={top - HALF_OF_RECT_SIZE}
        width={RECT_SIZE}
        height={RECT_SIZE}
      />,
      <rect
        key="right-top"
        className={s.controlPoint}
        x={right - HALF_OF_RECT_SIZE}
        y={top - HALF_OF_RECT_SIZE}
        width={RECT_SIZE}
        height={RECT_SIZE}
      />,
      <rect
        key={30}
        className={s.controlPoint}
        x={right - HALF_OF_RECT_SIZE}
        y={bottom - HALF_OF_RECT_SIZE}
        width={RECT_SIZE}
        height={RECT_SIZE}
      />,
      <rect
        key="left-bottom"
        className={s.controlPoint}
        x={left - HALF_OF_RECT_SIZE}
        y={bottom - HALF_OF_RECT_SIZE}
        width={RECT_SIZE}
        height={RECT_SIZE}
      />,
    ]
  })()

  // const [bboxPath, revalidatePathElement] = useMemoRevailidatable(() => {
  //   const d = SVGPathManipul.vectorPathPointsToSVGPath(visu.path.points)

  //   return (
  //     <>
  //       <MemoPath
  //         stroke="transparent"
  //         d={d}
  //         strokeWidth={3 * elementScale}
  //         onClick={onClickPath}
  //         className={s.previewStroke}
  //         style={{ cursor: 'pointer', touchAction: 'none' }}
  //         {...bindDrag()}
  //       />
  //     </>
  //   )
  // }, [/* FIXME: */ visu.path, onClickPath])

  return (
    <g
      data-pplc-component="VisuElement"
      data-pplc-visu-uid={visu.uid}
      style={{
        display: !visu.visible ? 'none' : undefined,
        pointerEvents: editor.selectedVisuUidMap[visu.uid]
          ? 'painted'
          : 'stroke',
        transform: `translate(${visu.transform.position.x}px, ${visu.transform.position.y}px)`,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={s.root}
      data-editable-tooled={isEditableToolMode}
    >
      {elements}
      <g>
        {visu.type === 'vectorObject' && (
          <VectorObjectElement visuUid={visu.uid} visu={visu} />
        )}
      </g>
    </g>
  )
})

const usePathStyle = createUseStyles({
  root: {
    outline: 'none',
  },
  bbox: {
    stroke: 'none',
    fill: 'none',
    pointerEvents: 'painted',
    '&:where([data-editable-tooled="true"] > *)': {
      fill: 'transparent',
      strokeWidth: 2,
      stroke: 'var(--pplc-stroke-color)',
    },
    // '&:hover': {
    //   cursor: 'move',
    //   stroke: 'var(--pplc-stroke-color)',
    // },
  },
  controlPoint: {
    display: 'none',
    fill: 'white',
    stroke: 'var(--pplc-stroke-color)',
    strokeWidth: 1.5,
    paintOrder: 'fill stroke',
    '&:where([data-editable-tooled="true"] > *)': {
      display: 'inline',
    },
  },
})

const MemoPath = memo(function MemoPath(props: SVGProps<SVGPathElement>) {
  return <path {...props} />
})

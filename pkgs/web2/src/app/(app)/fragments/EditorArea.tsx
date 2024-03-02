import {
  forwardRef,
  memo,
  useRef,
  useState,
  ComponentProps,
  useEffect,
} from 'react'
import { useGesture } from '@use-gesture/react'
import { css } from 'styled-components'
import { checkerBoard } from '@/utils/cssMixin'
import {
  usePaplicoInstance,
  initializeOnlyUseEngineStore,
} from '@/domains/engine'
import { useCombineRef } from '@/utils/hooks'
import useEvent from 'react-use-event-hook'
import { MainToolbar } from './MainToolbar'
import useMeasure from 'use-measure'
import { useEditorStore } from '@/domains/uiState'
import { bindPaplico } from '@paplico/editor'
import { Notification } from './EditorArea/Notification'
import { useDropArea, useUpdate } from 'react-use'
import { Commands, Document } from '@paplico/core-new'
import { loadImage } from '@hanakla/arma'
import { StoreApi, create } from 'zustand'
import { storePicker } from '@/utils/zustand'

type Props = { className?: string }

type CanvasTransform = {
  x: number
  y: number
  scale: number
  rotateDeg: number
}

type CanvasStore = {
  startOrigin: [number, number] | null
  startTransform: CanvasTransform | null
  current: CanvasTransform

  set: StoreApi<CanvasStore>['setState']
}

const useCanvasState = create<CanvasStore>((set, get) => ({
  startOrigin: null,
  startTransform: null,
  current: {
    x: 0,
    y: 0,
    scale: 0.7,
    rotateDeg: 0,
  },
  set,
}))

export const EditorArea = memo(
  forwardRef<HTMLCanvasElement, Props>(function EditorArea(
    { className },
    canvasRef,
  ) {
    const { pplc, canvasEditor } = usePaplicoInstance()
    const papStore = initializeOnlyUseEngineStore(
      storePicker(['_setEditorHandle']),
    )

    const editorStore = useEditorStore()
    const canvasState = useCanvasState()

    const rootRef = useRef<HTMLDivElement | null>(null)
    const toolbarRef = useRef<HTMLDivElement | null>(null)
    const vectorEditorRef = useRef<HTMLDivElement | null>(null)
    const combCanvasRef = useCombineRef<HTMLCanvasElement | null>(canvasRef)

    const rerender = useUpdate()

    const [toolbarPosition, setToolbarPosition] = useState<{
      x: number
      y: number
    }>({
      x: 0,
      y: 0,
    })

    const handleChangeToolbarPosition = useEvent<
      ComponentProps<typeof MainToolbar>['onPositionChanged']
    >((delta) => {
      editorStore.setToolbarPosition((prev) => ({
        x: (prev?.x ?? 0) + delta.x,
        y: (prev?.y ?? 0) + delta.y,
      }))

      setToolbarPosition((prev) => ({
        x: prev.x + delta.x,
        y: prev.y + delta.y,
      }))
    })

    const [bindDrop] = useDropArea({
      onFiles: async ([file]) => {
        if (!file) return
        if (!file.type.startsWith('image/')) return

        const url = URL.createObjectURL(file)
        const image = await loadImage(url)
        URL.revokeObjectURL(url)

        const visu = await Document.visu.createCanvasVisuallyFromImage(image, {
          // colorSpace: 'display-p3',
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 0.4, y: 0.4 },
            rotate: 0,
          },
        })

        canvasEditor?.command.do(
          new Commands.DocumentManipulateLayerNodes({
            add: [
              {
                visu,
                parentNodePath:
                  canvasEditor.getStrokingTarget()?.nodePath ?? [],
                indexInNode: -1,
              },
            ],
          }),
        )
      },
    })

    useGesture(
      {
        onPinch: ({ delta: [d, r], origin: [x, y], first, event }) => {
          // const rbx = rootRef.current!.getBoundingClientRect()
          const c = combCanvasRef.current!.getBoundingClientRect()

          canvasState.set((prevState, prev = prevState.current) => {
            // SEE: https://kano.arkoak.com/2020/06/04/zoom/

            // 現在の変形を考慮しない、キャンバスに対するピンチの中心点を取得
            const xOnCanvas = (x - c.left) / prev.scale - prev.x / prev.scale
            const yOnCanvas = (y - c.top) / prev.scale - prev.y / prev.scale

            const newScale = Math.max(0.1, prev.scale + d)

            // 拡大・縮小の影響を受けた後のキャンバスの位置の差異を計算
            const offsetX = xOnCanvas * newScale - xOnCanvas * prev.scale
            const offsetY = yOnCanvas * newScale - yOnCanvas * prev.scale

            // 新しいオフセットを計算
            const newX = prev.x - offsetX
            const newY = prev.y - offsetY

            canvasEditor?.setCanvasScaledScale(newScale)

            return {
              current: {
                scale: newScale,
                rotateDeg: prev.rotateDeg + r,
                x: newX,
                y: newY,
              },
            }
          })
        },

        onWheel: ({ event, delta, touches }) => {
          event.preventDefault()

          canvasState.set((prevState, prev = prevState.current) => ({
            current: {
              ...prev,
              x: prev.x - delta[0] * (1 / prev.scale),
              y: prev.y - delta[1] * (1 / prev.scale),
            },
          }))
        },

        onDrag: (e) => {
          if (e.touches < 2) return

          canvasState.set((prevState, prev = prevState.current) => ({
            current: {
              ...prev,
              x: prev.x + e.delta[0] * (1 / prev.scale),
              y: prev.y + e.delta[1] * (1 / prev.scale),
            },
          }))

          // execute(EditorOps.setCanvasTransform, {
          //   pos: ({ x, y }) => ({
          //     x: x + e.delta[0],
          //     y: y + e.delta[1],
          //   }),
          // })
        },
      },
      {
        target: rootRef,
        pinch: { eventOptions: { passive: true } },
        drag: { eventOptions: { passive: true } },
        wheel: { eventOptions: { passive: false } },
      },
    )

    const rootBBox = useMeasure(rootRef)
    const toolbarBBox = useMeasure(toolbarRef)

    useEffect(() => {
      setToolbarPosition({
        x: editorStore.toolbarPosition?.x ?? rootBBox.width / 2,
        y: editorStore.toolbarPosition?.x ?? rootBBox.height - 65,
      })
    }, [rootBBox.width, rootBBox.height])

    useEffect(() => {
      if (!pplc || !combCanvasRef) return

      const handle = bindPaplico(
        vectorEditorRef.current!,
        combCanvasRef.current!,
        pplc,
      )

      papStore._setEditorHandle(handle)
      handle.setCanvasScaledScale(canvasState.current.scale)
      const off = pplc.on('documentChanged', rerender)

      return () => {
        off()
        handle.dispose()
        papStore._setEditorHandle(null)
      }
    }, [pplc])

    useEffect(() => {
      // const doc = canvasEditor?.currentDocument
      // if (!doc) return
      // const size = fitAndPosition(
      //   {
      //     width: clamp(rootBBox.width, 0, 1000),
      //     height: clamp(rootBBox.height, 0, 1000),
      //   },
      //   {
      //     width: doc.meta.mainArtboard.width,
      //     height: doc.meta.mainArtboard.height,
      //   },
      //   'contain',
      // )
      // const scale =
      //   Math.max(size.width, size.height) /
      //   Math.max(doc.meta.mainArtboard.width, doc.meta.mainArtboard.height)
      // canvasState.set({
      //   current: { x: 0, y: 0, scale: scale, rotateDeg: 0 },
      // })
    }, [canvasEditor?.currentDocument?.uid])

    return (
      <div
        ref={rootRef}
        css={css`
          touch-action: manipulation !important;
          user-select: none !important;
          background-color: var(--gray-5);
        `}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
        data-editorarea-root
        {...bindDrop}
        // tabIndex={-1}
      >
        <div
          suppressHydrationWarning
          css={css`
            position: relative;
            touch-action: none;
          `}
          style={{
            transformOrigin: /* center */ '50% 50%',
            transform:
              `scale(${canvasState.current.scale}) ` +
              `rotate(${canvasState.current.rotateDeg}deg) ` +
              `translate(${canvasState.current.x}px, ${canvasState.current.y}px)`,
          }}
        >
          <div
            ref={vectorEditorRef}
            css={css`
              position: absolute;
              pointer-events: none;
            `}
          />
          <canvas
            ref={combCanvasRef}
            css={css`
              background-color: #fff;
              ${checkerBoard({ size: 10, opacity: 0.1 })};
            `}
            width={canvasEditor?.currentDocument?.meta.mainArtboard.width ?? 1}
            height={
              canvasEditor?.currentDocument?.meta.mainArtboard.height ?? 1
            }
            style={
              {
                // aspectRatio: papRef.current?.currentDocument
                //   ? `${papRef.current.currentDocument.meta.mainArtboard.width}/${papRef.current.currentDocument.meta.mainArtboard.height}`
                //   : '1',
              }
            }
          />
        </div>

        <Notification />

        <MainToolbar
          ref={toolbarRef}
          x={Math.max(
            toolbarBBox.width / 2,
            Math.min(toolbarPosition.x, rootBBox.width - toolbarBBox.width / 2),
          )}
          y={Math.max(
            toolbarBBox.height / 2,
            Math.min(
              toolbarPosition.y,
              rootBBox.height - toolbarBBox.height / 2,
            ),
          )}
          onPositionChanged={handleChangeToolbarPosition}
        />
      </div>
    )
  }),
)

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
import { checkerBoard } from '../../utils/cssMixin'
import { usePaplico, usePaplicoStore } from '../../domains/paplico'
import { useCombineRef, usePropsMemo } from '../../utils/hooks'
import useEvent from 'react-use-event-hook'
import { MainToolbar } from './MainToolbar'
import useMeasure from 'use-measure'
import { useEditorStore } from '@/domains/uiState'
import { bindPaplico } from '@paplico/vector-editor'
import { storePicker } from '@/utils/zutrand'

type Props = { className?: string }

export const EditorArea = memo(
  forwardRef<HTMLCanvasElement, Props>(function EditorArea(
    { className },
    canvasRef,
  ) {
    const { pap, editorHandle } = usePaplico()
    const papStore = usePaplicoStore(
      storePicker(['_setEditorHandle', 'editorHandle']),
    )
    const propsMemo = usePropsMemo()

    const editorStore = useEditorStore()
    const { canvasTransform } = editorStore

    const rootRef = useRef<HTMLDivElement | null>(null)
    const toolbarRef = useRef<HTMLDivElement | null>(null)
    const vectorEditorRef = useRef<HTMLDivElement | null>(null)
    const transformRootRef = useCombineRef<HTMLDivElement | null>(rootRef)
    const combCanvasRef = useCombineRef<HTMLCanvasElement | null>(canvasRef)

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

    useGesture(
      {
        onPinch: ({ delta: [d, r], origin: [x, y] }) => {
          const c = combCanvasRef.current!.getBoundingClientRect()

          editorStore.setCanvasTransform((prev) => {
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

            editorHandle?.setCanvasScaledScale(newScale)

            return {
              ...prev,
              scale: newScale,
              rotateDeg: prev.rotateDeg + r,
              x: newX,
              y: newY,
            }
          })
        },

        onWheel: ({ event, delta, touches }) => {
          event.preventDefault()

          editorStore.setCanvasTransform((prev) => ({
            ...prev,
            x: prev.x - delta[0],
            y: prev.y - delta[1],
          }))
        },

        onDrag: (e) => {
          if (e.touches < 2) return

          editorStore.setCanvasTransform((prev) => ({
            ...prev,
            x: prev.x + e.delta[0],
            y: prev.y + e.delta[1],
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
      if (!pap) return
      const handle = bindPaplico(vectorEditorRef.current!, pap)
      papStore._setEditorHandle(handle)
      handle.setCanvasScaledScale(canvasTransform.scale)

      return () => {
        handle.dispose()
        papStore._setEditorHandle(null)
      }
    }, [pap])

    return (
      <div
        ref={rootRef}
        css={css`
          touch-action: none;
          background-color: var(--gray-3);
        `}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
        data-editorarea-root
      >
        <div
          ref={transformRootRef}
          suppressHydrationWarning
          css={css`
            position: relative;
            touch-action: none;
          `}
          style={{
            transformOrigin: /* center */ '50% 50%',
            transform: `scale(${canvasTransform.scale}) rotate(${canvasTransform.rotateDeg}deg) translate(${canvasTransform.x}px, ${canvasTransform.y}px)`,
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
            width={pap?.currentDocument?.meta.mainArtboard.width ?? 0}
            height={pap?.currentDocument?.meta.mainArtboard.height ?? 0}
            style={
              {
                // aspectRatio: papRef.current?.currentDocument
                //   ? `${papRef.current.currentDocument.meta.mainArtboard.width}/${papRef.current.currentDocument.meta.mainArtboard.height}`
                //   : '1',
              }
            }
          />
        </div>

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

const MemoizedMainToolbar = memo(MainToolbar)

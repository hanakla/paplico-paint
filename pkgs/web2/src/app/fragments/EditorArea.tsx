import { forwardRef, memo, useRef } from 'react'
import { useGesture } from '@use-gesture/react'
import { css } from 'styled-components'
import { checkerBoard } from '../../utils/cssMixin'
import { usePaplico } from '../../domains/paplico'
import useMeasure from 'use-measure'
import { useCombineRef } from '../../utils/hooks'

type Props = { className?: string }

export const EditorArea = memo(
  forwardRef<HTMLCanvasElement, Props>(function EditorArea(
    { className },
    canvasRef,
  ) {
    const { papStore } = usePaplico()
    const { canvasTransform } = papStore

    const rootRef = useRef<HTMLDivElement | null>(null)
    const transformRootRef = useCombineRef<HTMLDivElement | null>(rootRef)
    const combCanvasRef = useCombineRef<HTMLCanvasElement | null>(canvasRef)
    // const canvasBBox = useMeasure(combCanvasRef)

    useGesture(
      {
        onPinch: ({ delta: [d, r], origin: [x, y] }) => {
          const c = combCanvasRef.current.getBoundingClientRect()

          papStore.setCanvasTransform((prev) => {
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

            return {
              ...prev,
              scale: newScale,
              rotate: prev.rotateDeg + r,
              x: newX,
              y: newY,
            }
          })
        },

        onWheel: ({ event, delta, touches }) => {
          event.preventDefault()

          papStore.setCanvasTransform((prev) => ({
            ...prev,
            x: prev.x - delta[0],
            y: prev.y - delta[1],
          }))
        },

        onDrag: (e) => {
          if (e.touches < 2) return

          papStore.setCanvasTransform((prev) => ({
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

    return (
      <div
        ref={rootRef}
        css={css`
          width: 100%;
          height: 100%;
          touch-action: none;
        `}
        className={className}
      >
        <div
          ref={transformRootRef}
          style={{
            transformOrigin: /* center */ '50% 50%',
            transform: `scale(${canvasTransform.scale}) rotate(${canvasTransform.rotateDeg}deg) translate(${canvasTransform.x}px, ${canvasTransform.y}px)`,
          }}
        >
          <canvas
            ref={combCanvasRef}
            css={css`
              background-color: #fff;
              ${checkerBoard({ size: 10, opacity: 0.1 })};
            `}
            width={1000}
            height={1000}
            style={
              {
                // aspectRatio: papRef.current?.currentDocument
                //   ? `${papRef.current.currentDocument.meta.mainArtboard.width}/${papRef.current.currentDocument.meta.mainArtboard.height}`
                //   : '1',
              }
            }
          />
        </div>
      </div>
    )
  }),
)

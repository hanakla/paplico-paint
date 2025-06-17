import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react'

export interface TextOverlayRef {
  drawText: (text: string, x: number, y: number, options?: TextOptions) => void
  clearText: () => void
  resize: (width: number, height: number) => void
}

export interface TextOptions {
  font?: string
  fontSize?: number
  color?: string
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  strokeColor?: string
  strokeWidth?: number
}

interface TextOverlayProps {
  width: number
  height: number
  className?: string
}

/** Canvas 2Dベースの軽量テキストオーバーレイコンポーネント */
export const TextOverlay = forwardRef<TextOverlayRef, TextOverlayProps>(
  ({ width, height, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useImperativeHandle(ref, () => ({
      drawText: (
        text: string,
        x: number,
        y: number,
        options: TextOptions = {},
      ) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // デフォルト設定
        const {
          font = 'Arial',
          fontSize = 16,
          color = '#000000',
          align = 'left',
          baseline = 'top',
          strokeColor,
          strokeWidth = 1,
        } = options

        // フォント設定
        ctx.font = `${fontSize}px ${font}`
        ctx.textAlign = align
        ctx.textBaseline = baseline

        // ストロークがある場合
        if (strokeColor && strokeWidth > 0) {
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = strokeWidth
          ctx.strokeText(text, x, y)
        }

        // テキスト描画
        ctx.fillStyle = color
        ctx.fillText(text, x, y)
      },

      clearText: () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
      },

      resize: (newWidth: number, newHeight: number) => {
        const canvas = canvasRef.current
        if (!canvas) return

        canvas.width = newWidth
        canvas.height = newHeight
      },
    }))

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      // 高DPI対応
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }
    }, [width, height])

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
    )
  },
)

TextOverlay.displayName = 'TextOverlay'

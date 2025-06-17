import { useRef, useCallback } from 'react'
import type { TextOverlayRef, TextOptions } from '@/components/ui/TextOverlay'

/** Canvas 2Dテキスト描画を管理するカスタムフック */
export const useTextRenderer = () => {
  const textOverlayRef = useRef<TextOverlayRef>(null)

  /** 指定位置にテキストを描画 */
  const drawText = useCallback(
    (text: string, x: number, y: number, options?: TextOptions) => {
      textOverlayRef.current?.drawText(text, x, y, options)
    },
    [],
  )

  /** 全てのテキストをクリア */
  const clearText = useCallback(() => {
    textOverlayRef.current?.clearText()
  }, [])

  /** キャンバスサイズを変更 */
  const resizeCanvas = useCallback((width: number, height: number) => {
    textOverlayRef.current?.resize(width, height)
  }, [])

  /** UI要素のテキストを描画する便利関数 */
  const drawUIText = useCallback(
    (
      text: string,
      x: number,
      y: number,
      style: 'label' | 'value' | 'warning' | 'error' = 'label',
    ) => {
      const styleOptions: Record<string, TextOptions> = {
        label: {
          fontSize: 12,
          color: '#666666',
          font: 'system-ui',
        },
        value: {
          fontSize: 14,
          color: '#000000',
          font: 'monospace',
        },
        warning: {
          fontSize: 12,
          color: '#ff9500',
          font: 'system-ui',
          strokeColor: '#ffffff',
          strokeWidth: 2,
        },
        error: {
          fontSize: 12,
          color: '#ff3b30',
          font: 'system-ui',
          strokeColor: '#ffffff',
          strokeWidth: 2,
        },
      }

      drawText(text, x, y, styleOptions[style])
    },
    [drawText],
  )

  /** 座標情報を表示 */
  const drawCoordinateInfo = useCallback(
    (worldX: number, worldY: number, screenX: number, screenY: number) => {
      clearText()

      const padding = 10
      drawUIText(
        `World: (${worldX.toFixed(1)}, ${worldY.toFixed(1)})`,
        padding,
        padding,
        'value',
      )
      drawUIText(
        `Screen: (${screenX.toFixed(0)}, ${screenY.toFixed(0)})`,
        padding,
        padding + 20,
        'label',
      )
    },
    [clearText, drawUIText],
  )

  /** パフォーマンス情報を表示 */
  const drawPerformanceInfo = useCallback(
    (fps: number, drawCalls: number, memory?: string) => {
      const canvasWidth = 800 // TODO: 実際のキャンバス幅を取得
      const padding = 10
      const rightX = canvasWidth - 150

      drawUIText(`FPS: ${fps.toFixed(1)}`, rightX, padding, 'value')
      drawUIText(`Draws: ${drawCalls}`, rightX, padding + 20, 'label')
      if (memory) {
        drawUIText(`Memory: ${memory}`, rightX, padding + 40, 'label')
      }
    },
    [drawUIText],
  )

  return {
    textOverlayRef,
    drawText,
    clearText,
    resizeCanvas,
    drawUIText,
    drawCoordinateInfo,
    drawPerformanceInfo,
  }
}

import {
  IWebGPUUIComponent,
  UICoordinateSystem,
  UIRenderLayer,
} from './IWebGPUUIComponent'
import { DocumentContext } from '../../document-manager'
import { Camera2D } from '../../camera/camera-2d'
import { UIBuilder } from './ui-elements'

/**
 * スクリーン座標系でのUI要素描画クラス
 * 新しいUIシステムを使用してスクリーン固定UI要素を生成
 */
export class ScreenUIRenderer implements IWebGPUUIComponent {
  private showCrosshair: boolean = false
  private showDebugInfo: boolean = false

  constructor(
    options: { showCrosshair?: boolean; showDebugInfo?: boolean } = {},
  ) {
    this.showCrosshair = options.showCrosshair ?? false
    this.showDebugInfo = options.showDebugInfo ?? false
  }

  /**
   * スクリーン座標系のUI要素を生成してUIBuilderに追加
   */
  generateElements(
    documentContext: DocumentContext,
    uiBuilder: UIBuilder,
    camera?: Camera2D,
    canvasSize?: { width: number; height: number },
  ): void {
    // 十字線を表示
    if (this.showCrosshair && canvasSize) {
      this.addCrosshair(uiBuilder, canvasSize)
    }

    // デバッグ情報を表示
    if (this.showDebugInfo && camera && canvasSize) {
      this.addDebugInfo(uiBuilder, camera, canvasSize)
    }

    // ツールバーやその他のスクリーン固定UI要素をここに追加できます
    this.addToolbar(uiBuilder, canvasSize)
  }

  /**
   * スクリーン座標で十字線を追加（カメラに影響されない）
   */
  private addCrosshair(
    uiBuilder: UIBuilder,
    canvasSize: { width: number; height: number },
  ): void {
    const centerX = canvasSize.width / 2
    const centerY = canvasSize.height / 2
    const lineLength = 20
    const lineWidth = 2

    // 水平線
    uiBuilder.surface({
      id: 'crosshair-horizontal',
      position: 'screen', // スクリーン座標で固定
      location: { x: centerX - lineLength, y: centerY - lineWidth / 2 },
      size: { width: lineLength * 2, height: lineWidth },
      zIndex: 10000, // 最前面
      backgroundColor: { r: 1.0, g: 1.0, b: 1.0, a: 0.8 }, // 半透明の白
      fillMode: 'fill',
    })

    // 垂直線
    uiBuilder.surface({
      id: 'crosshair-vertical',
      position: 'screen',
      location: { x: centerX - lineWidth / 2, y: centerY - lineLength },
      size: { width: lineWidth, height: lineLength * 2 },
      zIndex: 10000,
      backgroundColor: { r: 1.0, g: 1.0, b: 1.0, a: 0.8 },
      fillMode: 'fill',
    })
  }

  /**
   * デバッグ情報を追加
   */
  private addDebugInfo(
    uiBuilder: UIBuilder,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
  ): void {
    const debugPadding = 10
    const lineHeight = 18

    // カメラ情報
    const cameraInfo = [
      `Zoom: ${camera.getZoom().toFixed(2)}`,
      `Position: (${camera.getPosition().x.toFixed(1)}, ${camera
        .getPosition()
        .y.toFixed(1)})`,
      `Canvas: ${canvasSize.width}x${canvasSize.height}`,
    ]

    // デバッグ情報の背景パネル
    uiBuilder.surface({
      id: 'debug-info-panel',
      position: 'screen',
      location: { x: debugPadding, y: debugPadding },
      size: {
        width: 200,
        height: cameraInfo.length * lineHeight + debugPadding,
      },
      zIndex: 9999,
      backgroundColor: { r: 0.0, g: 0.0, b: 0.0, a: 0.7 }, // 半透明の黒
      borderColor: { r: 0.5, g: 0.5, b: 0.5, a: 0.8 },
      borderWidth: 1,
      fillMode: 'both',
    })

    // デバッグテキスト
    cameraInfo.forEach((info, index) => {
      uiBuilder.text(info, {
        id: `debug-info-${index}`,
        position: 'screen',
        location: {
          x: debugPadding + 5,
          y: debugPadding + 5 + index * lineHeight,
        },
        zIndex: 10000,
        fontSize: 12,
        fontFamily: 'monospace',
        color: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }, // 白いテキスト
      })
    })
  }

  /**
   * ツールバーを追加（例）
   */
  private addToolbar(
    uiBuilder: UIBuilder,
    canvasSize?: { width: number; height: number },
  ): void {
    if (!canvasSize) return

    const toolbarHeight = 40
    const buttonSize = 32
    const buttonSpacing = 8
    const toolbarPadding = 4

    // ツールバー背景
    uiBuilder.surface({
      id: 'toolbar-background',
      position: 'screen',
      location: { x: 0, y: 0 },
      size: { width: canvasSize.width, height: toolbarHeight },
      zIndex: 9000,
      backgroundColor: { r: 0.2, g: 0.2, b: 0.2, a: 0.9 }, // ダークグレー
      borderColor: { r: 0.4, g: 0.4, b: 0.4, a: 1.0 },
      borderWidth: 1,
      fillMode: 'both',
    })

    // ツールボタン
    const tools = ['brush', 'eraser', 'select', 'move']
    tools.forEach((tool, index) => {
      const x = toolbarPadding + index * (buttonSize + buttonSpacing)
      const y = toolbarPadding

      uiBuilder.button(
        tool,
        () => {
          // Tool selected: ${tool}
        },
        {
          id: `tool-${tool}`,
          position: 'screen',
          location: { x, y },
          size: { width: buttonSize, height: buttonSize },
          zIndex: 9001,
          backgroundColor: { r: 0.4, g: 0.4, b: 0.4, a: 1.0 },
          borderColor: { r: 0.6, g: 0.6, b: 0.6, a: 1.0 },
          borderWidth: 1,
          textColor: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
          fontSize: 10,
        },
      )
    })
  }

  /**
   * 十字線の表示/非表示を切り替え
   */
  setCrosshairVisible(visible: boolean): void {
    this.showCrosshair = visible
  }

  /**
   * デバッグ情報の表示/非表示を切り替え
   */
  setDebugInfoVisible(visible: boolean): void {
    this.showDebugInfo = visible
  }

  /**
   * レガシーレンダリング用（将来削除予定）
   */
  async render(
    renderPass: GPURenderPassEncoder,
    documentContext: DocumentContext,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    // このメソッドは非推奨 - generateElements()を使用してください
    console.warn(
      'ScreenUIRenderer.render() is deprecated. Use generateElements() instead.',
    )
  }

  /**
   * このコンポーネントの座標系
   */
  getCoordinateSystem(): UICoordinateSystem {
    return 'screen'
  }

  /**
   * このコンポーネントの描画レイヤー
   */
  getRenderLayer(): UIRenderLayer {
    return 'foreground'
  }

  /**
   * リソースを解放
   */
  destroy(): void {
    // 新しいUIシステムではリソース管理は自動化されているため、特別な処理は不要
  }
}

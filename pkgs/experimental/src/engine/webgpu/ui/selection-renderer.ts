import type { Camera2D } from '../../camera/camera-2d'
import type { DocumentContext } from '../../document-manager'
import { selectionState } from '../../selection-state'
import type { EngineState } from '../../state'
import type {
  IWebGPUUIComponent,
  UICoordinateSystem,
  UIRenderLayer,
} from './IWebGPUUIComponent'
import type { UIBuilder } from './ui-elements'

/**
 * 選択範囲UIのWebGPU描画を管理するクラス
 * 新しいUIシステムを使用して選択範囲UIを生成
 */
export class SelectionRenderer implements IWebGPUUIComponent {
  private engineState: EngineState

  constructor(engineState: EngineState) {
    this.engineState = engineState
  }

  /**
   * 選択範囲のUI要素を生成してUIBuilderに追加
   */
  generateElements(
    documentContext: DocumentContext,
    uiBuilder: UIBuilder,
  ): void {
    const document = documentContext.document

    // selection-state.tsからselectionStateを直接参照
    const selectedIds = Array.from(selectionState.selectedObjects)

    // 選択されたオブジェクトの境界ボックスを生成
    for (const objectId of selectedIds) {
      const artObject = document.artObjects[objectId]
      if (!artObject || !artObject.visible) continue

      this.addSelectionBounds(uiBuilder, artObject, objectId)
    }

    // ドラッグ中の範囲選択を生成
    if (selectionState.isDragSelecting && selectionState.dragSelectionBox) {
      this.addDragSelection(uiBuilder)
    }
  }

  /**
   * 選択されたオブジェクトの境界線UI要素を追加
   */
  private addSelectionBounds(
    uiBuilder: UIBuilder,
    artObject: any,
    objectId: string,
  ): void {
    if (artObject.type !== 'path' || !artObject.path?.points?.length) return

    // パスの境界ボックスを計算
    const points = artObject.path.points
    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    for (const point of points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    const padding = 10
    let bounds = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding,
    }

    // ドラッグ中の場合はオフセットを適用して視覚的なプレビューを表示
    if (selectionState.isDragging && selectionState.dragOffset) {
      bounds = {
        x: bounds.x + selectionState.dragOffset.x,
        y: bounds.y + selectionState.dragOffset.y,
        width: bounds.width,
        height: bounds.height,
      }
    }

    // 選択境界線をサーフェス要素として追加
    const borderColor = selectionState.isDragging
      ? { r: 1.0, g: 0.7, b: 0.2, a: 1.0 } // ドラッグ中はオレンジ色
      : { r: 0.2, g: 0.6, b: 1.0, a: 1.0 } // 通常は青色

    uiBuilder.surface({
      id: `selection-bounds-${objectId}`,
      position: 'local', // ワールド座標に追従
      location: { x: bounds.x, y: bounds.y },
      size: { width: bounds.width, height: bounds.height },
      zIndex: 10000, // オブジェクトより遥かに前面に描画
      borderColor,
      borderWidth: 2,
      fillMode: 'stroke', // ストロークのみ
    })

    // 選択ハンドルを追加
    this.addSelectionHandles(uiBuilder, bounds, objectId)
  }

  /**
   * 選択ハンドルのUI要素を追加
   */
  private addSelectionHandles(
    uiBuilder: UIBuilder,
    bounds: { x: number; y: number; width: number; height: number },
    objectId: string,
  ): void {
    const handleSize = 8
    const halfHandle = handleSize / 2

    // 8つの選択ハンドル（四隅 + 辺の中点）
    const handles = [
      // 四隅
      { x: bounds.x - halfHandle, y: bounds.y - halfHandle, id: 'top-left' },
      {
        x: bounds.x + bounds.width - halfHandle,
        y: bounds.y - halfHandle,
        id: 'top-right',
      },
      {
        x: bounds.x - halfHandle,
        y: bounds.y + bounds.height - halfHandle,
        id: 'bottom-left',
      },
      {
        x: bounds.x + bounds.width - halfHandle,
        y: bounds.y + bounds.height - halfHandle,
        id: 'bottom-right',
      },
      // 辺の中点
      {
        x: bounds.x + bounds.width / 2 - halfHandle,
        y: bounds.y - halfHandle,
        id: 'top-center',
      },
      {
        x: bounds.x + bounds.width / 2 - halfHandle,
        y: bounds.y + bounds.height - halfHandle,
        id: 'bottom-center',
      },
      {
        x: bounds.x - halfHandle,
        y: bounds.y + bounds.height / 2 - halfHandle,
        id: 'left-center',
      },
      {
        x: bounds.x + bounds.width - halfHandle,
        y: bounds.y + bounds.height / 2 - halfHandle,
        id: 'right-center',
      },
    ]

    for (const handle of handles) {
      uiBuilder.surface({
        id: `selection-handle-${objectId}-${handle.id}`,
        position: 'local',
        location: { x: handle.x, y: handle.y },
        size: { width: handleSize, height: handleSize },
        zIndex: 10001, // 選択境界線より前面
        backgroundColor: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }, // 白い背景
        borderColor: { r: 0.2, g: 0.6, b: 1.0, a: 1.0 }, // 青い境界線
        borderWidth: 1,
        fillMode: 'both',
      })
    }
  }

  /**
   * ドラッグ選択範囲のUI要素を追加
   */
  private addDragSelection(uiBuilder: UIBuilder): void {
    const dragSelectionBox = selectionState.dragSelectionBox

    if (!dragSelectionBox) return

    // ドラッグ選択矩形をサーフェス要素として追加
    uiBuilder.surface({
      id: 'drag-selection-rect',
      position: 'local', // ワールド座標に追従
      location: { x: dragSelectionBox.x, y: dragSelectionBox.y },
      size: { width: dragSelectionBox.width, height: dragSelectionBox.height },
      zIndex: 9999, // 選択境界線より背面だが、オブジェクトより前面
      borderColor: { r: 0.2, g: 0.6, b: 1.0, a: 0.8 }, // 半透明の青色
      borderWidth: 1,
      backgroundColor: { r: 0.2, g: 0.6, b: 1.0, a: 0.1 }, // 非常に薄い青色の背景
      fillMode: 'both', // 境界線と背景の両方
    })
  }

  /**
   * レガシーレンダリング用（将来削除予定）
   */
  async render(
    _renderPass: GPURenderPassEncoder,
    _documentContext: DocumentContext,
    _camera: Camera2D,
    _canvasSize: { width: number; height: number },
    _buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    // このメソッドは非推奨 - generateElements()を使用してください
    console.warn(
      'SelectionRenderer.render() is deprecated. Use generateElements() instead.',
    )
  }

  /**
   * このコンポーネントの座標系
   */
  getCoordinateSystem(): UICoordinateSystem {
    return 'world'
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

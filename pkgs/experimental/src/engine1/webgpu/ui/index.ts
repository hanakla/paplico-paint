/**
 * WebGPU UI Integration
 *
 * メインWebGPUエンジンとUIレンダリングシステムの統合
 */

import { selectionState } from '../../selection-state';
import { ArtboardRenderer } from './artboard-renderer';
import type { IWebGPUUIComponent } from './IWebGPUUIComponent';
import { ScreenUIRenderer } from './screen-ui-renderer';
import { SelectionRenderer } from './selection-renderer';
import type { TextUIElement, UIElement } from './ui-elements';
import { UIBuilder } from './ui-elements';

export type {
  AnyUIElement,
  ButtonUIElement,
  PathUIElement,
  SurfaceUIElement,
  TextStyle,
  TextUIElement,
  UIElement,
  UIRenderOptions,
} from './ui-elements';
export { UIBuilder } from './ui-elements';

// WebGPU宣言的UI設定
export interface WebGPUIDeclaration {
  artboards?: {
    background?: boolean;
    foreground?: boolean;
    showLabels?: boolean;
    showBounds?: boolean;
  };
  selection?: {
    enabled?: boolean;
    showHandles?: boolean;
  };
  screenUI?: {
    coordinateGrid?: boolean;
    rulers?: boolean;
  };
}

export interface WebGPUComponentContext {
  device: GPUDevice;
  pipelines: {
    line: GPURenderPipeline;
    fill: GPURenderPipeline;
    text: GPURenderPipeline;
  };
  state: any;
}

// UI管理クラス
export class UIManager {
  private elements: Map<string, UIElement> = new Map();
  private hoveredElement: string | null = null;
  private selectedObjectIds: Set<string> = new Set();
  private lastHitResults: any[] = []; // HitTestResult[]

  /**
   * 選択状態を更新（ヒットテスト結果から）
   */
  updateSelectionFromHitTest(hitResults: any[]): void {
    this.lastHitResults = hitResults;
    this.selectedObjectIds = new Set(hitResults.map((hit) => hit.artObject.id));
  }

  /**
   * 選択状態をクリア
   */
  clearSelection(): void {
    this.selectedObjectIds.clear();
    this.lastHitResults = [];
  }

  /**
   * 選択されたオブジェクトIDsを取得
   */
  getSelectedObjectIds(): Set<string> {
    return new Set(this.selectedObjectIds);
  }

  /**
   * オブジェクトが選択されているかチェック
   */
  isObjectSelected(objectId: string): boolean {
    return this.selectedObjectIds.has(objectId);
  }

  /**
   * 宣言的設定からWebGPUコンポーネントを生成
   */
  createWebGPUComponents(
    declaration: WebGPUIDeclaration,
    context: WebGPUComponentContext,
  ): IWebGPUUIComponent[] {
    const components: IWebGPUUIComponent[] = [];

    // アートボードレンダラー
    if (declaration.artboards?.background) {
      components.push(
        new ArtboardRenderer({ showBounds: true, showBackground: true }),
      );
    }

    if (declaration.artboards?.foreground) {
      components.push(
        new ArtboardRenderer({ showBounds: true, showBackground: false }),
      );
    }

    // 選択コンポーネント
    if (declaration.selection?.enabled) {
      components.push(new SelectionRenderer(context.state));
    }

    // スクリーンUIコンポーネント
    if (declaration.screenUI?.coordinateGrid || declaration.screenUI?.rulers) {
      components.push(
        new ScreenUIRenderer({ showCrosshair: true, showDebugInfo: true }),
      );
    }

    return components;
  }

  addElement(element: UIElement): void {
    this.elements.set(element.id, element);
  }

  removeElement(id: string): void {
    this.elements.delete(id);
  }

  updateElement(id: string, updates: Partial<UIElement>): void {
    const element = this.elements.get(id);
    if (element) {
      Object.assign(element, updates);
    }
  }

  /** マウス位置での当たり判定を実行 */
  handleMouseEvent(x: number, y: number, eventType: 'click' | 'move'): boolean {
    const hitElement = this.getElementAtPosition(x, y);

    if (eventType === 'move') {
      // ホバー状態の更新
      if (this.hoveredElement !== hitElement?.id) {
        // 前の要素のホバーを解除
        if (this.hoveredElement) {
          const _prevElement = this.elements.get(this.hoveredElement);
          // onHoverプロパティは現在のUIElementには存在しないためスキップ
        }

        // 新しい要素のホバーを設定
        this.hoveredElement = hitElement?.id || null;
        // onHoverプロパティは現在のUIElementには存在しないためスキップ
      }
    } else if (eventType === 'click') {
      // onClickプロパティは現在のUIElementには存在しないためスキップ
      return hitElement !== null; // イベントがヒットしたかどうかを返す
    }

    return false;
  }

  /** 指定位置にあるUI要素を取得（最前面から検索） */
  private getElementAtPosition(x: number, y: number): UIElement | null {
    const sortedElements = Array.from(this.elements.values())
      .filter((el) => el.visible)
      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)); // 最前面から検索

    for (const element of sortedElements) {
      if (this.isPointInElement(x, y, element)) {
        return element;
      }
    }

    return null;
  }

  /** 点がUI要素内にあるかチェック */
  private isPointInElement(x: number, y: number, element: UIElement): boolean {
    const size = element.size || this.getElementDefaultSize(element);
    const location = element.location || { x: 0, y: 0 };

    return (
      x >= location.x &&
      x <= location.x + size.width &&
      y >= location.y &&
      y <= location.y + size.height
    );
  }

  /** UI要素のデフォルトサイズを取得 */
  private getElementDefaultSize(element: UIElement): {
    width: number;
    height: number;
  } {
    switch (element.type) {
      case 'text': {
        const textEl = element as TextUIElement;
        // テキストサイズを概算（実際の実装では正確な測定が必要）
        return {
          width:
            textEl.text.length *
            (textEl.style?.fontSize || textEl.fontSize || 16) *
            0.6,
          height: textEl.style?.fontSize || textEl.fontSize || 16,
        };
      }
      case 'icon':
        return { width: 24, height: 24 };
      default:
        return { width: 100, height: 30 };
    }
  }

  /**
   * ドキュメントからアートボードUIを構築
   */
  buildArtboardUI(
    documentContext: any,
    uiBuilder: UIBuilder,
    _options: {
      showBackground?: boolean;
      showLabel?: boolean;
      showBounds?: boolean;
    } = {},
  ): void {
    const document = documentContext.document;
    if (!document.artboards || document.artboards.length === 0) return;

    for (const artboard of document.artboards) {
      if (!artboard.visible) continue;

      // Artboard rendering temporarily disabled - replaced with surface
      uiBuilder.surface({
        id: `artboard-${artboard.id}`,
        location: { x: artboard.bounds.x, y: artboard.bounds.y },
        size: { width: artboard.bounds.width, height: artboard.bounds.height },
        position: 'local',
        borderColor: { r: 0.8, g: 0.8, b: 0.8, a: 1.0 },
        borderWidth: 1,
        zIndex: -500,
      });
    }
  }

  async renderUI(
    _renderPass: GPURenderPassEncoder,
    documentContext?: any,
    _camera?: any,
    _canvasSize?: { width: number; height: number },
    _webgpuEngine?: any,
  ): Promise<GPUBuffer[]> {
    // UI要素の生成のみ（実際のレンダリングはui-component-managerで行われる）

    // 宣言的UIビルダーを使用してシステムUIを構築
    const uiBuilder = new UIBuilder();

    // アートボードを描画（ドキュメントが提供された場合）
    if (documentContext) {
      this.buildArtboardUI(documentContext, uiBuilder, {
        showBackground: true,
        showLabel: true,
        showBounds: true,
      });
    }

    // 矩形選択ドラッグボックスの描画（点線枠のみ、塗りなし）
    if (selectionState.isDragSelecting && selectionState.dragSelectionBox) {
      const bbox = selectionState.dragSelectionBox;

      // Drag selection box rendering - replaced with surface
      uiBuilder.surface({
        id: 'drag-selection-box',
        location: { x: bbox.x, y: bbox.y },
        size: { width: bbox.width, height: bbox.height },
        position: 'local',
        borderColor: { r: 0.2, g: 0.6, b: 1.0, a: 0.8 },
        borderWidth: 2,
        fillMode: 'stroke', // ストロークのみ
        zIndex: 9999, // オブジェクトより前面に表示
      });
    }

    // UIComponentManagerから選択範囲UIを生成
    if (this.lastHitResults.length > 0) {
      // レイキャスト結果を使用してUIBuilderで選択範囲を構築
      const raycastHits = this.lastHitResults;

      if (raycastHits.length > 0) {
        // 選択されたパスの青いアウトライン表示
        for (const hit of raycastHits) {
          const artObject = hit.artObject;
          if (artObject.type === 'path' && artObject.path?.points) {
            // Path outline rendering using path element
            uiBuilder.path(artObject.path, {
              id: `path-outline-${artObject.id}`,
              position: 'local',
              strokeColor: { r: 0.2, g: 0.6, b: 1.0, a: 0.8 },
              strokeWidth: 3,
              zIndex: 9998, // オブジェクトより前面に表示
            });
          }
        }

        // 選択範囲のバウンディングボックスを計算
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        for (const hit of raycastHits) {
          const bbox = hit.boundingBox || {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          };
          minX = Math.min(minX, bbox.x);
          minY = Math.min(minY, bbox.y);
          maxX = Math.max(maxX, bbox.x + bbox.width);
          maxY = Math.max(maxY, bbox.y + bbox.height);
        }

        if (
          Number.isFinite(minX) &&
          Number.isFinite(minY) &&
          Number.isFinite(maxX) &&
          Number.isFinite(maxY)
        ) {
          const selectionBounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          };

          // Raycast selection box rendering - replaced with surface
          uiBuilder.surface({
            id: 'raycast-selection',
            location: { x: selectionBounds.x, y: selectionBounds.y },
            size: {
              width: selectionBounds.width,
              height: selectionBounds.height,
            },
            position: 'local',
            borderColor: { r: 0.2, g: 0.6, b: 1.0, a: 1.0 },
            borderWidth: 2,
            fillMode: 'stroke',
            zIndex: 10000, // オブジェクトより前面に表示
          });

          // Handle drag temporarily disabled
          const _onHandleDrag = (
            _handleType: string,
            _deltaX: number,
            _deltaY: number,
          ) => {
            // Handle drag logic would go here
          };
          const _onSelectionMove = (_deltaX: number, _deltaY: number) => {
            // Selection move logic would go here
          };
        }
      }
    }

    // レガシー選択状態との互換性（既存システムが使用している場合）
    if (
      selectionState.boundingBox &&
      selectionState.selectedObjects.size > 0 &&
      this.lastHitResults.length === 0
    ) {
      const bbox = selectionState.boundingBox;
      // Legacy selection box rendering - replaced with surface
      uiBuilder.surface({
        id: 'legacy-selection-bounding-box',
        location: { x: bbox.x, y: bbox.y },
        size: { width: bbox.width, height: bbox.height },
        position: 'local',
        borderColor: { r: 0.2, g: 0.6, b: 1.0, a: 1.0 },
        borderWidth: 2,
        fillMode: 'stroke',
        zIndex: 10000, // オブジェクトより前面に表示
      });
    }

    // UI要素の生成は完了（実際のレンダリングはui-component-managerが担当）
    return [];
  }
}

import type { Camera2D } from '../../camera/camera-2d';
import type { Artboard } from '../../document/artboard';
import type { DocumentContext } from '../../document-manager';
import type {
  IWebGPUUIComponent,
  UICoordinateSystem,
  UIRenderLayer,
} from './IWebGPUUIComponent';
import type { UIBuilder } from './ui-elements';

/**
 * アートボード描画を管理する統合クラス（境界線・背景・ラベル）
 * 新しいUIシステムを使用してアートボード要素を生成
 */
export class ArtboardRenderer implements IWebGPUUIComponent {
  private showBounds: boolean = true;
  private showBackground: boolean = false;
  private showLabels: boolean = true;

  constructor(
    options: {
      showBounds?: boolean;
      showBackground?: boolean;
      showLabels?: boolean;
    } = {},
  ) {
    this.showBounds = options.showBounds ?? true;
    this.showBackground = options.showBackground ?? false;
    this.showLabels = options.showLabels ?? true;
  }

  /**
   * 個別のアートボード要素を追加（境界線・背景・ラベル）
   */
  private addArtboardElements(uiBuilder: UIBuilder, artboard: Artboard): void {
    const { bounds } = artboard;

    // アートボードのバウンディングボックス妥当性チェック
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    // アートボード境界線/背景をサーフェス要素として追加
    if (this.showBounds || this.showBackground) {
      uiBuilder.surface({
        id: `artboard-bounds-${artboard.id}`,
        position: 'local', // ワールド座標に追従
        location: { x: bounds.x, y: bounds.y },
        size: { width: bounds.width, height: bounds.height },
        zIndex: -1000, // 最背面に描画
        backgroundColor: this.showBackground
          ? { r: 1.0, g: 1.0, b: 1.0, a: 1.0 } // 白い背景
          : undefined,
        borderColor: this.showBounds
          ? { r: 0.6, g: 0.6, b: 0.6, a: 1.0 } // グレーの境界線
          : undefined,
        borderWidth: this.showBounds ? 1 : 0,
        fillMode:
          this.showBackground && this.showBounds
            ? 'both'
            : this.showBackground
              ? 'fill'
              : this.showBounds
                ? 'stroke'
                : undefined,
      });
    }

    // アートボード名をラベルとして追加
    if (this.showLabels) {
      this.addArtboardLabel(uiBuilder, artboard);
    }
  }

  /**
   * アートボード名のラベルUI要素を追加
   */
  private addArtboardLabel(uiBuilder: UIBuilder, artboard: Artboard): void {
    const { bounds } = artboard;
    const labelPadding = 4;
    const fontSize = 12;

    // ラベルテキスト（アートボード内の左上に配置）
    const textOptions = {
      id: `artboard-label-${artboard.id}`,
      name: `artboard-label-${artboard.name}`, // デバッグ用の名前
      position: 'local' as const, // ワールド座標系を使用（カメラに追従）
      location: {
        x: bounds.x + labelPadding,
        y: bounds.y + labelPadding,
      },
      zIndex: -998, // 境界線より少し前面
      fontSize: fontSize,
      fontFamily: 'Arial, sans-serif',
      color: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 }, // ダークグレー
      padding: labelPadding,
      bold: false,
    };

    uiBuilder.text(artboard.name, textOptions);
  }

  /**
   * 境界線の表示/非表示を切り替え
   */
  setBoundsVisible(visible: boolean): void {
    this.showBounds = visible;
  }

  /**
   * 背景の表示/非表示を切り替え
   */
  setBackgroundVisible(visible: boolean): void {
    this.showBackground = visible;
  }

  /**
   * ラベルの表示/非表示を切り替え
   */
  setLabelsVisible(visible: boolean): void {
    this.showLabels = visible;
  }

  /**
   * アートボード要素を生成してUIBuilderに追加
   */
  generateElements(
    documentContext: DocumentContext,
    uiBuilder: UIBuilder,
  ): void {
    const document = documentContext.document;

    if (!document.artboards || document.artboards.length === 0) {
      return;
    }

    // 各アートボードの要素を生成
    for (const artboard of document.artboards) {
      if (!artboard.visible) continue;

      this.addArtboardElements(uiBuilder, artboard);
    }
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
      'ArtboardRenderer.render() is deprecated. Use generateElements() instead.',
    );
  }

  /**
   * このコンポーネントの座標系
   */
  getCoordinateSystem(): UICoordinateSystem {
    return 'world';
  }

  /**
   * このコンポーネントの描画レイヤー
   */
  getRenderLayer(): UIRenderLayer {
    return 'background';
  }

  /**
   * リソースを解放
   */
  destroy(): void {
    // 新しいUIシステムではリソース管理は自動化されているため、特別な処理は不要
  }
}

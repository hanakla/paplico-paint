import type { Camera2D } from '../../camera/camera-2d';
import type { DocumentContext } from '../../document-manager';

/**
 * UI要素の座標系
 */
export type UICoordinateSystem = 'screen' | 'world';

/**
 * UI要素の描画レイヤー
 */
export type UIRenderLayer = 'background' | 'foreground';

/**
 * WebGPU UIコンポーネントの共通インターフェース
 */
export interface IWebGPUUIComponent {
  /**
   * UIコンポーネントをレンダリング
   */
  render(
    renderPass: GPURenderPassEncoder,
    documentContext: DocumentContext,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void>;

  /**
   * このコンポーネントの座標系
   */
  getCoordinateSystem(): UICoordinateSystem;

  /**
   * このコンポーネントの描画レイヤー
   */
  getRenderLayer(): UIRenderLayer;

  /**
   * リソースを解放
   */
  destroy(): void;
}

/**
 * 座標変換ユーティリティ
 */
export class CoordinateTransform {
  /**
   * ワールド座標をクリップ座標に変換（カメラ変換適用）
   * Camera2Dのviewマトリックスと同じ座標系を使用（画面中心が原点）
   */
  static worldToClip(
    x: number,
    y: number,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
  ): [number, number] {
    // カメラ位置からの相対座標を計算
    const relativeX = x - camera.getPosition().x;
    const relativeY = y - camera.getPosition().y;

    // ズームを適用
    const scaledX = relativeX * camera.getZoom();
    const scaledY = relativeY * camera.getZoom();

    // 画面中心への移動を適用（Camera2Dのviewマトリックスと同じ）
    const screenX = scaledX + canvasSize.width / 2;
    const screenY = scaledY + canvasSize.height / 2;

    // クリップ座標に変換
    const clipX = (screenX / canvasSize.width) * 2 - 1;
    const clipY = -((screenY / canvasSize.height) * 2 - 1);

    return [clipX, clipY];
  }

  /**
   * スクリーン座標をクリップ座標に変換（カメラ変換なし）
   */
  static screenToClip(
    x: number,
    y: number,
    canvasSize: { width: number; height: number },
  ): [number, number] {
    const clipX = (x / canvasSize.width) * 2 - 1;
    const clipY = -((y / canvasSize.height) * 2 - 1);

    return [clipX, clipY];
  }
}

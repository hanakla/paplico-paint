/**
 * バウンディングボックスの定義
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * アピアランスプロセッサーのインターフェース
 * 各アピアランス（Fill、Stroke等）の共通インターフェース
 */
export interface IAppearanceProcessor {
  /**
   * アピアランスを描画する
   * @param renderPass WebGPUレンダーパス
   * @param path 描画対象のパス
   * @param appearance アピアランス設定
   * @param projectionMatrix プロジェクション行列
   * @param viewMatrix ビュー行列
   * @param canvasSize キャンバスサイズ
   * @param inputBounds 直前のアピアランスから渡されるバウンディングボックス
   * @returns 描画に使用したバッファ配列と更新されたバウンディングボックス
   */
  render(
    renderPass: GPURenderPassEncoder,
    path: any,
    appearance: any,
    projectionMatrix: Float32Array,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
    inputBounds: BoundingBox,
  ): Promise<{ buffers: GPUBuffer[]; bounds: BoundingBox }>;

  /**
   * アピアランスが適用される予想バウンディングボックスを計算する
   * @param path 描画対象のパス
   * @param appearance アピアランス設定
   * @param inputBounds 直前のアピアランスから渡されるバウンディングボックス
   * @returns 予想されるバウンディングボックス
   */
  calculateBounds(
    path: any,
    appearance: any,
    inputBounds: BoundingBox,
  ): BoundingBox;
}

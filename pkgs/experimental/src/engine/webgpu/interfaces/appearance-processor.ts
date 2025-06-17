import { Bounds } from '../../document/types'
import {
  FillAppearance,
  StrokeAppearance,
  DropShadowAppearance,
} from '../../document/appearance'

/**
 * アピアランス処理の基底インターフェース
 */
export interface IAppearanceProcessor<T = any> {
  /**
   * アピアランスが適用された場合の最終的なバウンディングボックスを計算
   * @param inputBounds 入力となるバウンディングボックス（前のアピアランスの結果）
   * @param appearance 適用するアピアランス
   * @returns 最終的なバウンディングボックス
   */
  calculateBounds(inputBounds: Bounds, appearance: T): Bounds

  /**
   * WebGPU描画処理を実行
   * @param renderPass レンダーパス
   * @param path パスデータ
   * @param appearance アピアランス
   * @param projectionMatrix プロジェクション行列
   * @param viewMatrix ビュー行列
   * @param canvasSize キャンバスサイズ
   * @returns 作成されたバッファの配列（破棄用）
   */
  render(
    renderPass: any,
    path: any,
    appearance: T,
    projectionMatrix: Float32Array,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
  ): Promise<GPUBuffer[]>
}

/**
 * Fill専用プロセッサーインターフェース
 */
export interface IFillProcessor extends IAppearanceProcessor<FillAppearance> {}

/**
 * Stroke専用プロセッサーインターフェース
 */
export interface IStrokeProcessor
  extends IAppearanceProcessor<StrokeAppearance> {}

/**
 * DropShadow専用プロセッサーインターフェース
 */
export interface IDropShadowProcessor
  extends IAppearanceProcessor<DropShadowAppearance> {}

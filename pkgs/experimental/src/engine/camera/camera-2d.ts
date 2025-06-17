import { Vector2 } from '../math/vector2'

export interface CameraConfig {
  width: number
  height: number
}

/**
 * 2Dカメラクラス
 * ビューポート変換とワールド座標系の管理
 */
export class Camera2D {
  private x: number = 0
  private y: number = 0
  private zoom: number = 1
  private rotation: number = 0
  private width: number
  private height: number

  constructor(config: CameraConfig) {
    this.width = config.width
    this.height = config.height
  }

  /**
   * カメラ位置を設定
   */
  setPosition(x: number, y: number): void {
    this.x = x
    this.y = y
  }

  /**
   * ズームレベルを設定
   */
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, Math.min(10, zoom))
  }

  /**
   * 回転角度を設定（ラジアン）
   */
  setRotation(rotation: number): void {
    this.rotation = rotation
  }

  /**
   * ビューポートサイズを設定
   */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height
  }

  /**
   * 画面座標を世界座標に変換
   */
  screenToWorld(x: number, y: number): Vector2 {
    // スクリーン中心を原点とする座標系に変換
    const centerX = x - this.width / 2
    const centerY = y - this.height / 2

    // ズームを適用
    const scaledX = centerX / this.zoom
    const scaledY = centerY / this.zoom

    // 回転を適用（逆回転）
    const cos = Math.cos(-this.rotation)
    const sin = Math.sin(-this.rotation)
    const rotatedX = scaledX * cos - scaledY * sin
    const rotatedY = scaledX * sin + scaledY * cos

    // カメラ位置を適用
    return {
      x: rotatedX + this.x,
      y: rotatedY + this.y,
    }
  }

  /**
   * 世界座標を画面座標に変換
   */
  worldToScreen(x: number, y: number): Vector2 {
    // カメラ位置を減算
    const relativeX = x - this.x
    const relativeY = y - this.y

    // 回転を適用
    const cos = Math.cos(this.rotation)
    const sin = Math.sin(this.rotation)
    const rotatedX = relativeX * cos - relativeY * sin
    const rotatedY = relativeX * sin + relativeY * cos

    // ズームを適用
    const scaledX = rotatedX * this.zoom
    const scaledY = rotatedY * this.zoom

    // スクリーン座標系に変換
    return {
      x: scaledX + this.width / 2,
      y: scaledY + this.height / 2,
    }
  }

  /**
   * ビュー変換行列を取得（WebGPU用）
   */
  getViewMatrix(): Float32Array {
    const cos = Math.cos(-this.rotation)
    const sin = Math.sin(-this.rotation)

    // 平行移動 -> 回転 -> スケーリング -> 中央寄せ の順で変換
    return new Float32Array([
      cos * this.zoom,
      -sin * this.zoom,
      0,
      sin * this.zoom,
      cos * this.zoom,
      0,
      (-this.x * cos + this.y * sin) * this.zoom + this.width / 2,
      (-this.x * sin - this.y * cos) * this.zoom + this.height / 2,
      1,
    ])
  }

  /**
   * プロジェクション行列を取得（WebGPU用）
   */
  getProjectionMatrix(): Float32Array {
    // NDC座標系への変換行列
    return new Float32Array([
      2 / this.width,
      0,
      0,
      0,
      -2 / this.height,
      0,
      -1,
      1,
      1,
    ])
  }

  /**
   * 現在のカメラ位置を取得
   */
  getPosition(): Vector2 {
    return { x: this.x, y: this.y }
  }

  /**
   * 現在のズームレベルを取得
   */
  getZoom(): number {
    return this.zoom
  }

  /**
   * 現在の回転角度を取得
   */
  getRotation(): number {
    return this.rotation
  }

  /**
   * ビューポートサイズを取得
   */
  getViewportSize(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }
}

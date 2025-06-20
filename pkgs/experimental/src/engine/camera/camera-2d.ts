import { Vector2 } from '../math/vector2'

/**
 * 2Dカメラクラス
 * ビューポート変換とワールド座標系の管理
 */
export class Camera2D {
  private x: number = 0
  private y: number = 0
  private zoom: number = 1
  private rotation: number = 0

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
   * カメラ位置を取得
   */
  getPosition(): Vector2 {
    return { x: this.x, y: this.y }
  }

  /**
   * ズームレベルを取得
   */
  getZoom(): number {
    return this.zoom
  }

  /**
   * カメラのクローンを作成
   */
  clone(): Camera2D {
    const cloned = new Camera2D()
    cloned.setPosition(this.x, this.y)
    cloned.setZoom(this.zoom)
    cloned.setRotation(this.rotation)
    return cloned
  }

  /**
   * 回転角度を設定（ラジアン）
   */
  setRotation(rotation: number): void {
    this.rotation = rotation
  }

  /**
   * 画面座標を世界座標に変換
   */
  screenToWorld(x: number, y: number, width: number, height: number): Vector2 {
    // スクリーン中心を原点とする座標系に変換
    const centerX = x - width / 2
    const centerY = y - height / 2

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
  worldToScreen(x: number, y: number, width: number, height: number): Vector2 {
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
      x: scaledX + width / 2,
      y: scaledY + height / 2,
    }
  }

  /**
   * ビュー変換行列を取得（WebGPU用）
   * 4x4行列として返す
   */
  getViewMatrix(width: number, height: number): Float32Array {
    const cos = Math.cos(-this.rotation)
    const sin = Math.sin(-this.rotation)

    // 4x4 view matrix (column-major order)
    return new Float32Array([
      cos * this.zoom,
      -sin * this.zoom,
      0,
      0,
      sin * this.zoom,
      cos * this.zoom,
      0,
      0,
      0,
      0,
      1,
      0,
      (-this.x * cos + this.y * sin) * this.zoom + width / 2,
      (-this.x * sin - this.y * cos) * this.zoom + height / 2,
      0,
      1,
    ])
  }

  /**
   * プロジェクション行列を取得（WebGPU用）
   * 4x4行列として返す
   */
  getProjectionMatrix(width: number, height: number): Float32Array {
    // 4x4 orthographic projection matrix (column-major order)
    return new Float32Array([
      2 / width,
      0,
      0,
      0,
      0,
      -2 / height,
      0,
      0,
      0,
      0,
      1,
      0,
      -1,
      1,
      0,
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
}

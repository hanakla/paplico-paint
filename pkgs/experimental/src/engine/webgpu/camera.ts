export interface CameraState {
  /** カメラの位置 (world coordinates) */
  position: { x: number; y: number }
  /** ズームレベル (1.0 = 100%) */
  zoom: number
  /** 回転角度 (radians) */
  rotation: number
  /** カメラが見る範囲 (world coordinates) */
  viewport: {
    width: number
    height: number
  }
}

/**
 * 2Dカメラシステム
 * パン、ズーム、回転機能を提供
 */
export class Camera2D {
  private state: CameraState
  private canvasSize: { width: number; height: number }
  private projectionMatrix: Float32Array = new Float32Array(16)
  private viewMatrix: Float32Array = new Float32Array(16)
  private isDirty = true

  constructor(canvasSize: { width: number; height: number }) {
    this.canvasSize = canvasSize
    this.state = {
      position: { x: 0, y: 0 },
      zoom: 1.0,
      rotation: 0,
      viewport: {
        width: canvasSize.width,
        height: canvasSize.height,
      },
    }
    this.updateMatrices()
  }

  /**
   * カメラをパン（移動）
   */
  pan(deltaX: number, deltaY: number): void {
    this.state.position.x += deltaX / this.state.zoom
    this.state.position.y += deltaY / this.state.zoom
    this.isDirty = true
  }

  /**
   * カメラをズーム
   */
  zoom(factor: number, centerX?: number, centerY?: number): void {
    const oldZoom = this.state.zoom
    this.state.zoom = Math.max(0.1, Math.min(10.0, this.state.zoom * factor))

    // ズーム中心点が指定された場合、その点を中心にズーム
    if (centerX !== undefined && centerY !== undefined) {
      const worldCenter = this.screenToWorld(centerX, centerY)
      const zoomDelta = this.state.zoom - oldZoom
      this.state.position.x -=
        (worldCenter.x - this.state.position.x) * (zoomDelta / this.state.zoom)
      this.state.position.y -=
        (worldCenter.y - this.state.position.y) * (zoomDelta / this.state.zoom)
    }

    this.isDirty = true
  }

  /**
   * カメラを回転
   */
  rotate(deltaAngle: number): void {
    this.state.rotation += deltaAngle
    // -π から π の範囲に正規化
    while (this.state.rotation > Math.PI) this.state.rotation -= 2 * Math.PI
    while (this.state.rotation < -Math.PI) this.state.rotation += 2 * Math.PI

    this.isDirty = true
  }

  /**
   * カメラを指定位置に設定
   */
  setPosition(x: number, y: number): void {
    this.state.position.x = x
    this.state.position.y = y
    this.isDirty = true
  }

  /**
   * ズームレベルを直接設定
   */
  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.1, Math.min(10.0, zoom))
    this.isDirty = true
  }

  /**
   * 回転角度を直接設定
   */
  setRotation(rotation: number): void {
    this.state.rotation = rotation
    this.isDirty = true
  }

  /**
   * カメラをリセット
   */
  reset(): void {
    this.state.position = { x: 0, y: 0 }
    this.state.zoom = 1.0
    this.state.rotation = 0
    this.isDirty = true
  }

  /**
   * 指定の矩形が画面に収まるようにカメラを調整
   */
  fitToRect(rect: {
    x: number
    y: number
    width: number
    height: number
  }): void {
    // 矩形の中心にカメラを配置
    this.state.position.x = rect.x + rect.width / 2
    this.state.position.y = rect.y + rect.height / 2

    // 矩形が画面に収まるズームレベルを計算
    const scaleX = this.canvasSize.width / rect.width
    const scaleY = this.canvasSize.height / rect.height
    this.state.zoom = Math.min(scaleX, scaleY) * 0.9 // 90%のマージンを残す

    this.state.rotation = 0
    this.isDirty = true
  }

  /**
   * スクリーン座標をワールド座標に変換
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // NDC座標に変換
    const ndcX = (screenX / this.canvasSize.width) * 2.0 - 1.0
    const ndcY = 1.0 - (screenY / this.canvasSize.height) * 2.0

    // 逆変換行列を適用
    const cos = Math.cos(-this.state.rotation)
    const sin = Math.sin(-this.state.rotation)

    // ズーム逆変換
    const viewX = (ndcX * (this.canvasSize.width / 2)) / this.state.zoom
    const viewY = (ndcY * (this.canvasSize.height / 2)) / this.state.zoom

    // 回転逆変換
    const worldX = viewX * cos - viewY * sin + this.state.position.x
    const worldY = viewX * sin + viewY * cos + this.state.position.y

    return { x: worldX, y: worldY }
  }

  /**
   * ワールド座標をスクリーン座標に変換
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    // カメラ中心からの相対座標
    const relX = worldX - this.state.position.x
    const relY = worldY - this.state.position.y

    // 回転変換
    const cos = Math.cos(this.state.rotation)
    const sin = Math.sin(this.state.rotation)
    const rotX = relX * cos - relY * sin
    const rotY = relX * sin + relY * cos

    // ズーム変換
    const viewX = rotX * this.state.zoom
    const viewY = rotY * this.state.zoom

    // NDC座標に変換
    const ndcX = viewX / (this.canvasSize.width / 2)
    const ndcY = viewY / (this.canvasSize.height / 2)

    // スクリーン座標に変換
    const screenX = ((ndcX + 1.0) * this.canvasSize.width) / 2.0
    const screenY = ((1.0 - ndcY) * this.canvasSize.height) / 2.0

    return { x: screenX, y: screenY }
  }

  /**
   * キャンバスサイズが変更された時の更新
   */
  updateCanvasSize(width: number, height: number): void {
    this.canvasSize = { width, height }
    this.state.viewport.width = width
    this.state.viewport.height = height
    this.isDirty = true
  }

  /**
   * 行列を更新
   */
  private updateMatrices(): void {
    if (!this.isDirty) return

    // プロジェクション行列（2D正射影）
    const left = -this.canvasSize.width / 2
    const right = this.canvasSize.width / 2
    const bottom = -this.canvasSize.height / 2
    const top = this.canvasSize.height / 2
    const near = -1000
    const far = 1000

    this.projectionMatrix.fill(0)
    this.projectionMatrix[0] = 2 / (right - left)
    this.projectionMatrix[5] = 2 / (top - bottom)
    this.projectionMatrix[10] = -2 / (far - near)
    this.projectionMatrix[12] = -(right + left) / (right - left)
    this.projectionMatrix[13] = -(top + bottom) / (top - bottom)
    this.projectionMatrix[14] = -(far + near) / (far - near)
    this.projectionMatrix[15] = 1

    // ビュー行列（カメラ変換）
    this.viewMatrix.fill(0)

    const cos = Math.cos(-this.state.rotation)
    const sin = Math.sin(-this.state.rotation)
    const scale = this.state.zoom

    // スケール + 回転
    this.viewMatrix[0] = cos * scale
    this.viewMatrix[1] = sin * scale
    this.viewMatrix[4] = -sin * scale
    this.viewMatrix[5] = cos * scale
    this.viewMatrix[10] = 1
    this.viewMatrix[15] = 1

    // 平行移動
    this.viewMatrix[12] =
      -this.state.position.x * scale * cos + this.state.position.y * scale * sin
    this.viewMatrix[13] =
      -this.state.position.x * scale * sin - this.state.position.y * scale * cos

    this.isDirty = false
  }

  /**
   * プロジェクション行列を取得
   */
  getProjectionMatrix(): Float32Array {
    this.updateMatrices()
    return this.projectionMatrix
  }

  /**
   * ビュー行列を取得
   */
  getViewMatrix(): Float32Array {
    this.updateMatrices()
    return this.viewMatrix
  }

  /**
   * カメラ状態を取得
   */
  getState(): Readonly<CameraState> {
    return this.state
  }

  /**
   * デバッグ情報を取得
   */
  getDebugInfo(): any {
    return {
      position: this.state.position,
      zoom: this.state.zoom,
      rotation: this.state.rotation,
      rotationDegrees: (this.state.rotation * 180) / Math.PI,
      canvasSize: this.canvasSize,
      viewport: this.state.viewport,
      projectionMatrix: Array.from(this.projectionMatrix),
      viewMatrix: Array.from(this.viewMatrix),
    }
  }
}

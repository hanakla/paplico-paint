import { WebGPUEngine } from './webgpu/core-engine'
import { InputManager } from './input/input-manager'
import { engineState, Vector2 } from './state'
import { Camera2D } from './camera/camera-2d'
import { proxy } from 'valtio'

/**
 * オブジェクト配置情報
 */
export interface ObjectBounds {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  center: Vector2
  edges: {
    top: number
    right: number
    bottom: number
    left: number
    centerX: number
    centerY: number
  }
}

/**
 * 配置ガイド情報
 */
export interface AlignmentGuides {
  vertical: number[]
  horizontal: number[]
  objects: ObjectBounds[]
}

/**
 * Paplico統合ステート
 */
export interface PaplicoState {
  camera: {
    x: number
    y: number
    zoom: number
    rotation: number
  }
  viewport: {
    width: number
    height: number
  }
  input: {
    isMouseDown: boolean
    isPanning: boolean
    isZooming: boolean
    lastPointerPosition: Vector2 | null
    pointerCount: number
  }
  alignment: AlignmentGuides
}

/**
 * Paplicoメインエンジンクラス
 * WebGPUEngine、InputManager、Camera2Dを統合管理
 */
export class PaplicoEngine {
  private canvas: HTMLCanvasElement
  private webgpuEngine: WebGPUEngine
  private inputManager: InputManager
  private camera: Camera2D
  private animationId: number | null = null
  private state: PaplicoState

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.webgpuEngine = new WebGPUEngine(canvas)
    this.inputManager = new InputManager(canvas)
    this.camera = new Camera2D({
      width: canvas.width,
      height: canvas.height,
    })

    // 統合ステートを初期化
    this.state = proxy<PaplicoState>({
      camera: {
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
      },
      viewport: {
        width: canvas.width,
        height: canvas.height,
      },
      input: {
        isMouseDown: false,
        isPanning: false,
        isZooming: false,
        lastPointerPosition: null,
        pointerCount: 0,
      },
      alignment: {
        vertical: [],
        horizontal: [],
        objects: [],
      },
    })

    this.setupInputHandlers()
    this.updateAlignmentGuides()
  }

  /**
   * エンジンを初期化
   */
  async initialize(): Promise<boolean> {
    const success = await this.webgpuEngine.initialize()
    if (success) {
      this.startRenderLoop()
      this.syncCameraWithState()
    }
    return success
  }

  /**
   * 入力ハンドラーを設定
   */
  private setupInputHandlers(): void {
    // マウス/タッチ開始
    this.inputManager.onPointerDown((event) => {
      this.state.input.isMouseDown = true
      this.state.input.lastPointerPosition = {
        x: event.clientX,
        y: event.clientY,
      }

      // 右クリックまたはミドルクリックでパンモード
      if (event.button === 1 || event.button === 2) {
        this.state.input.isPanning = true
        this.canvas.style.cursor = 'grab'
      }
    })

    // マウス/タッチ移動
    this.inputManager.onPointerMove((event) => {
      const currentPos = { x: event.clientX, y: event.clientY }

      if (this.state.input.isPanning && this.state.input.lastPointerPosition) {
        // パン操作
        const deltaX = currentPos.x - this.state.input.lastPointerPosition.x
        const deltaY = currentPos.y - this.state.input.lastPointerPosition.y

        this.pan(deltaX, deltaY)
      }

      this.state.input.lastPointerPosition = currentPos
    })

    // マウス/タッチ終了
    this.inputManager.onPointerUp(() => {
      this.state.input.isMouseDown = false
      this.state.input.isPanning = false
      this.state.input.lastPointerPosition = null
      this.canvas.style.cursor = 'default'
    })

    // ホイールズーム
    this.inputManager.onWheel((event) => {
      event.preventDefault()

      // Alt + ホイールでズーム
      if (event.altKey || event.ctrlKey) {
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
        const mousePos = { x: event.clientX, y: event.clientY }
        this.zoomAtPoint(zoomFactor, mousePos)
      } else {
        // 通常のスクロールでパン
        this.pan(-event.deltaX, -event.deltaY)
      }
    })

    // タッチイベント（ピンチズーム）
    this.canvas.addEventListener('touchstart', (event) => {
      this.state.input.pointerCount = event.touches.length

      if (event.touches.length === 2) {
        this.state.input.isZooming = true
        this.handlePinchStart(event)
      }
    })

    this.canvas.addEventListener('touchmove', (event) => {
      event.preventDefault()

      if (this.state.input.isZooming && event.touches.length === 2) {
        this.handlePinchZoom(event)
      }
    })

    this.canvas.addEventListener('touchend', (event) => {
      this.state.input.pointerCount = event.touches.length

      if (event.touches.length < 2) {
        this.state.input.isZooming = false
      }
    })

    // キーボードショートカット
    window.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'Space':
          if (!event.repeat) {
            this.state.input.isPanning = true
            this.canvas.style.cursor = 'grab'
          }
          event.preventDefault()
          break
        case 'Digit0':
          if (event.ctrlKey || event.metaKey) {
            this.resetView()
            event.preventDefault()
          }
          break
        case 'Equal':
        case 'NumpadAdd':
          if (event.ctrlKey || event.metaKey) {
            this.zoom(1.2)
            event.preventDefault()
          }
          break
        case 'Minus':
        case 'NumpadSubtract':
          if (event.ctrlKey || event.metaKey) {
            this.zoom(0.8)
            event.preventDefault()
          }
          break
      }
    })

    window.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'Space':
          this.state.input.isPanning = false
          this.canvas.style.cursor = 'default'
          break
      }
    })
  }

  /**
   * ピンチズーム開始
   */
  private pinchStartDistance: number = 0
  private pinchStartZoom: number = 1
  private pinchCenter: Vector2 = { x: 0, y: 0 }

  private handlePinchStart(event: TouchEvent): void {
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]

    this.pinchStartDistance = this.getTouchDistance(touch1, touch2)
    this.pinchStartZoom = this.state.camera.zoom
    this.pinchCenter = this.getTouchCenter(touch1, touch2)
  }

  private handlePinchZoom(event: TouchEvent): void {
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]

    const currentDistance = this.getTouchDistance(touch1, touch2)
    const zoomFactor = currentDistance / this.pinchStartDistance
    const newZoom = this.pinchStartZoom * zoomFactor

    this.setZoom(newZoom, this.pinchCenter)
  }

  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getTouchCenter(touch1: Touch, touch2: Touch): Vector2 {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    }
  }

  /**
   * パン操作
   */
  pan(deltaX: number, deltaY: number): void {
    this.state.camera.x -= deltaX / this.state.camera.zoom
    this.state.camera.y -= deltaY / this.state.camera.zoom
    this.syncCameraWithState()
  }

  /**
   * ズーム操作
   */
  zoom(factor: number): void {
    const center = {
      x: this.state.viewport.width / 2,
      y: this.state.viewport.height / 2,
    }
    this.zoomAtPoint(factor, center)
  }

  /**
   * 指定点を中心にズーム
   */
  zoomAtPoint(factor: number, screenPoint: Vector2): void {
    const worldPoint = this.screenToWorld(screenPoint)

    this.state.camera.zoom = Math.max(
      0.1,
      Math.min(10, this.state.camera.zoom * factor),
    )

    // ズーム後の世界座標を計算
    const newWorldPoint = this.screenToWorld(screenPoint)

    // カメラ位置を調整してズーム中心を維持
    this.state.camera.x += worldPoint.x - newWorldPoint.x
    this.state.camera.y += worldPoint.y - newWorldPoint.y

    this.syncCameraWithState()
  }

  /**
   * ズームレベルを設定
   */
  setZoom(zoom: number, center?: Vector2): void {
    const clampedZoom = Math.max(0.1, Math.min(10, zoom))
    const factor = clampedZoom / this.state.camera.zoom

    if (center) {
      this.zoomAtPoint(factor, center)
    } else {
      this.state.camera.zoom = clampedZoom
      this.syncCameraWithState()
    }
  }

  /**
   * 回転操作
   */
  rotate(angle: number): void {
    this.state.camera.rotation += angle
    this.syncCameraWithState()
  }

  /**
   * ビューをリセット
   */
  resetView(): void {
    this.state.camera.x = 0
    this.state.camera.y = 0
    this.state.camera.zoom = 1
    this.state.camera.rotation = 0
    this.syncCameraWithState()
  }

  /**
   * 画面座標を世界座標に変換
   */
  screenToWorld(screenPoint: Vector2): Vector2 {
    return this.camera.screenToWorld(screenPoint.x, screenPoint.y)
  }

  /**
   * 世界座標を画面座標に変換
   */
  worldToScreen(worldPoint: Vector2): Vector2 {
    return this.camera.worldToScreen(worldPoint.x, worldPoint.y)
  }

  /**
   * カメラステートを同期
   */
  private syncCameraWithState(): void {
    this.camera.setPosition(this.state.camera.x, this.state.camera.y)
    this.camera.setZoom(this.state.camera.zoom)
    this.camera.setRotation(this.state.camera.rotation)

    // エンジンステートも更新
    engineState.viewport.x = this.state.camera.x
    engineState.viewport.y = this.state.camera.y
    engineState.viewport.zoom = this.state.camera.zoom
    engineState.viewport.rotation = this.state.camera.rotation
  }

  /**
   * 配置ガイド情報を更新
   */
  private updateAlignmentGuides(): void {
    if (!engineState.document) {
      this.state.alignment.objects = []
      this.state.alignment.vertical = []
      this.state.alignment.horizontal = []
      return
    }

    const objects: ObjectBounds[] = []

    // ドキュメント内の全アートオブジェクトから配置情報を取得
    for (const [id, artObject] of engineState.document.artObjects) {
      if (artObject.type === 'path' && (artObject as any).path?.points) {
        const points = (artObject as any).path.points

        if (points.length > 0) {
          // バウンディングボックスを計算
          let minX = points[0].x
          let maxX = points[0].x
          let minY = points[0].y
          let maxY = points[0].y

          for (const point of points) {
            minX = Math.min(minX, point.x)
            maxX = Math.max(maxX, point.x)
            minY = Math.min(minY, point.y)
            maxY = Math.max(maxY, point.y)
          }

          const width = maxX - minX
          const height = maxY - minY
          const centerX = minX + width / 2
          const centerY = minY + height / 2

          objects.push({
            id,
            x: minX,
            y: minY,
            width,
            height,
            rotation: 0, // TODO: 回転情報があれば取得
            center: { x: centerX, y: centerY },
            edges: {
              top: minY,
              right: maxX,
              bottom: maxY,
              left: minX,
              centerX,
              centerY,
            },
          })
        }
      }
    }

    // 配置ガイドライン（エッジ情報）を生成
    const verticalLines = new Set<number>()
    const horizontalLines = new Set<number>()

    for (const obj of objects) {
      verticalLines.add(obj.edges.left)
      verticalLines.add(obj.edges.centerX)
      verticalLines.add(obj.edges.right)

      horizontalLines.add(obj.edges.top)
      horizontalLines.add(obj.edges.centerY)
      horizontalLines.add(obj.edges.bottom)
    }

    this.state.alignment.objects = objects
    this.state.alignment.vertical = Array.from(verticalLines).sort(
      (a, b) => a - b,
    )
    this.state.alignment.horizontal = Array.from(horizontalLines).sort(
      (a, b) => a - b,
    )
  }

  /**
   * レンダーループを開始
   */
  private startRenderLoop(): void {
    const render = () => {
      this.webgpuEngine.render()
      this.updateAlignmentGuides() // 毎フレーム更新
      this.animationId = requestAnimationFrame(render)
    }
    render()
  }

  /**
   * リサイズ処理
   */
  resize(width: number, height: number): void {
    this.state.viewport.width = width
    this.state.viewport.height = height
    this.camera.resize(width, height)
    this.webgpuEngine.resize(width, height)
  }

  /**
   * カメラインスタンスを取得
   */
  getCamera(): Camera2D {
    return this.camera
  }

  /**
   * WebGPUエンジンインスタンスを取得
   */
  getWebGPUEngine(): WebGPUEngine {
    return this.webgpuEngine
  }

  /**
   * 統合ステートを取得
   */
  getState(): PaplicoState {
    return this.state
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.webgpuEngine.destroy()
    this.inputManager.dispose()
  }
}

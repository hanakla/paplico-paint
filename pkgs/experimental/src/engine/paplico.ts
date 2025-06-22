import { proxy } from 'valtio'
import { Camera2D } from './camera/camera-2d'
import { AddArtObjectCommand, MoveArtObjectsCommand } from './commands'
import { DeleteArtObjectsCommand } from './commands/DeleteArtObjectsCommand'
import { createPathArtObject } from './document'
import { createStrokeAppearance } from './document/appearance'
import type { CreateDocumentParams } from './document/document'
import {
  DocumentSerializer,
  type SerializationOptions,
} from './document/serialization'
import type { UUID } from './document/types'
import {
  DocumentManager,
  type DocumentManagerChangeEvent,
} from './document-manager'
import type { IExporterStrategy } from './exporters/IExporterStrategy'
import type { ICommand } from './history/command'
import { type EnhancedPointerEvent, InputManager } from './input-manager'
import {
  clearDragSelection,
  clearSelection,
  endDrag,
  selectionState,
  selectObject,
  selectVertex,
  setExternalMoveObjectsFunction,
  startDrag,
  startDragSelection,
  toggleObjectSelection,
  updateDrag,
  updateDragSelection,
} from './selection-state'
import { createVectorPath, getStrokeParams, type Vector2 } from './state'
import { debugState, WebGPUEngine } from './webgpu/core-engine'

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
  alignment: AlignmentGuides
  activeDocumentId: UUID | null
  tools: {
    activeTool:
      | 'brush'
      | 'select'
      | 'move'
      | 'pan'
      | 'vertexSelect'
      | 'vertexEdit'
  }
}

interface InternalState {
  input: {
    isMouseDown: boolean
    isPanning: boolean
    isZooming: boolean
    lastPointerPosition: { x: number; y: number } | null
    pointerCount: number
  }
}

/**
 * Paplicoメインエンジンクラス
 * WebGPUEngine、InputManager、Camera2Dを統合管理
 */
export class PaplicoEngine {
  protected canvas: HTMLCanvasElement
  protected webgpuEngine: WebGPUEngine
  protected inputManager: InputManager
  protected camera: Camera2D
  protected animationId: number | null = null
  protected internalState: InternalState
  public state: PaplicoState
  public readonly documentManager: DocumentManager
  protected needsRender: boolean = true
  protected lastRenderTime: number = 0
  protected renderCheckInterval: number = 16 // 60fps

  // パフォーマンス測定用
  protected frameTimeSamples: number[] = []
  protected maxFrameTimeSamples: number = 60 // 60フレームで平均を計算
  protected totalRenderTimeAccumulator: number = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.webgpuEngine = new WebGPUEngine(canvas)
    this.inputManager = new InputManager(canvas, this)
    this.camera = new Camera2D()
    this.documentManager = new DocumentManager()

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

      alignment: {
        vertical: [],
        horizontal: [],
        objects: [],
      },
      activeDocumentId: null,
      tools: {
        activeTool: 'brush',
      },
    })

    this.internalState = {
      input: {
        isMouseDown: false,
        isPanning: false,
        isZooming: false,
        lastPointerPosition: null,
        pointerCount: 0,
      },
    }

    this.setupInputHandlers()
    this.setupDocumentManagerHandlers()
    this.setupSelectionMoveHandlers()
    this.updateAlignmentGuides()
  }

  /**
   * エンジンを初期化
   */
  async initialize(): Promise<boolean> {
    const initStartTime = performance.now()
    const success = await this.webgpuEngine.initialize()

    if (success) {
      this.startRenderLoop()
      this.syncCameraWithState()
      // 初期化完了後にドキュメントを同期
      this.syncDocumentToWebGPUState()

      // debugStateを更新
      debugState.paplicoEngine.performance.initializationTime =
        performance.now() - initStartTime
    }
    return success
  }

  /**
   * 入力ハンドラーを設定
   */
  private setupInputHandlers(): void {
    // debugStateの初期化
    this.updateDebugInputState()

    // 高レベルイベント：ストローク開始
    this.inputManager.on('strokeStart', (event) => {
      // debugStateに記録
      debugState.paplicoEngine.receivedStrokeStart = {
        activeTool: this.state.tools.activeTool,
        webgpuIsDrawing: this.webgpuEngine.state.isDrawing,
        timestamp: Date.now(),
      }

      if (this.state.tools.activeTool === 'brush') {
        // デバッグ: ストローク開始時の状態を記録
        debugState.paplicoEngine.strokeStart = {
          hasExistingStroke: this.webgpuEngine.state.isDrawing,
          timestamp: Date.now(),
        }

        this.handleDrawingStart(event.initialEvent)
      }
    })

    // 高レベルイベント：ストローク更新
    this.inputManager.on('strokeUpdate', (event) => {
      if (this.state.tools.activeTool === 'brush') {
        this.handleDrawingMove(event.currentEvent)
      }
    })

    // 高レベルイベント：ストローク完了
    this.inputManager.on('strokeComplete', (event) => {
      // debugStateに記録
      debugState.paplicoEngine.receivedStrokeComplete = {
        activeTool: this.state.tools.activeTool,
        webgpuIsDrawing: this.webgpuEngine.state.isDrawing,
        webgpuHasCurrentStroke: !!this.webgpuEngine.state.currentStroke,
        timestamp: Date.now(),
      }

      if (this.state.tools.activeTool === 'brush') {
        debugState.paplicoEngine.strokeComplete = {
          isDrawing: this.webgpuEngine.state.isDrawing,
          hasCurrentStroke: !!this.webgpuEngine.state.currentStroke,
          timestamp: Date.now(),
        }

        this.handleDrawingEnd(event.finalEvent)
      }
    })

    // 高レベルイベント：パン
    this.inputManager.on('pan', (event) => {
      this.pan(event.delta.x, event.delta.y)
      this.requestRender()
    })

    // 低レベルイベント（選択ツール用など）
    this.inputManager.on('pointerDown', (event) => {
      // デバッグ: 前のストロークが残っていないか確認
      if (
        this.state.tools.activeTool === 'brush' &&
        this.webgpuEngine.state.isDrawing
      ) {
        debugState.paplicoEngine.previousStrokeStillActive = {
          isDrawing: this.webgpuEngine.state.isDrawing,
          hasCurrentStroke: !!this.webgpuEngine.state.currentStroke,
          activeTool: this.state.tools.activeTool,
          timestamp: Date.now(),
        }
      }

      this.internalState.input.isMouseDown = true
      this.internalState.input.lastPointerPosition = {
        x: event.x,
        y: event.y,
      }

      // debugState更新
      debugState.paplicoEngine.input.isMouseDown = true
      debugState.paplicoEngine.input.lastEventTimestamp = Date.now()
      debugState.paplicoEngine.input.eventCount.pointerDown++

      // ツール別の処理（ブラシ以外）
      switch (this.state.tools.activeTool) {
        case 'select':
        case 'move':
          this.handleSelectionStart(event)
          // ヒットテストも実行
          this.performHitTest(event)
          break
        case 'vertexSelect':
        case 'vertexEdit':
          this.handleVertexEditStart(event)
          break
        default:
          break
      }
    })

    // マウス/タッチ移動（選択ツール用など）
    this.inputManager.on('pointerMove', (event) => {
      // debugState更新
      debugState.paplicoEngine.input.lastEventTimestamp = Date.now()
      debugState.paplicoEngine.input.eventCount.pointerMove++

      const currentPos = { x: event.x, y: event.y }

      // ツール別の移動処理（ブラシ以外）
      switch (this.state.tools.activeTool) {
        case 'select':
          if (selectionState.isDragSelecting || selectionState.isDragging) {
            this.handleSelectionMove(event)
          } else {
            // ホバー時のヒットテスト（選択ツール時のみ）
            this.performHoverHitTest(event)
          }
          break
        case 'move':
          if (selectionState.isDragging) {
            this.handleSelectionMove(event)
          } else {
            // ホバー時のヒットテスト（移動ツール時のみ）
            this.performHoverHitTest(event)
          }
          break
        case 'vertexSelect':
        case 'vertexEdit':
          this.handleVertexEditMove(event)
          break
      }

      this.internalState.input.lastPointerPosition = currentPos
    })

    // マウス/タッチ終了（選択ツール用など）
    this.inputManager.on('pointerUp', (event) => {
      // debugState更新
      debugState.paplicoEngine.input.isMouseDown = false
      debugState.paplicoEngine.input.isPanning = false
      debugState.paplicoEngine.input.lastEventTimestamp = Date.now()
      debugState.paplicoEngine.input.eventCount.pointerUp++

      // ツール別の終了処理（ブラシ以外）
      switch (this.state.tools.activeTool) {
        case 'select':
          if (selectionState.isDragSelecting || selectionState.isDragging) {
            this.handleSelectionEnd(event)
          }
          break
        case 'move':
          if (selectionState.isDragging) {
            this.handleSelectionEnd(event)
          }
          break
        case 'vertexSelect':
        case 'vertexEdit':
          this.handleVertexEditEnd(event)
          break
      }

      this.internalState.input.isMouseDown = false
      this.internalState.input.isPanning = false
      this.internalState.input.lastPointerPosition = null
      this.canvas.style.cursor = 'default'
    })

    // ホイールズーム
    this.inputManager.on('wheel', (event) => {
      event.preventDefault()

      // debugState更新
      debugState.paplicoEngine.input.lastEventTimestamp = Date.now()
      debugState.paplicoEngine.input.eventCount.wheel++

      // macOSでのピンチズーム検出 (ctrlKey + 連続的な小さなdeltaY)
      const isMacOSPinch =
        event.ctrlKey &&
        Math.abs(event.deltaX) < 50 &&
        Math.abs(event.deltaY) < 50 &&
        (event.deltaX !== 0 || event.deltaY !== 0)

      // Alt + ホイールでズーム、またはmacOSピンチズーム
      if (event.altKey || (event.ctrlKey && !isMacOSPinch)) {
        const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9
        const rect = this.canvas.getBoundingClientRect()
        const mousePos = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }

        this.zoomAtPoint(zoomFactor, mousePos)
        this.requestRender()
      } else if (isMacOSPinch) {
        // macOSピンチズーム (wheelイベントでctrlKey=trueの場合)
        const zoomFactor = 1 + event.deltaY * -0.01 // deltaYの符号を反転して感度調整
        const rect = this.canvas.getBoundingClientRect()
        const pinchCenter = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }

        this.zoomAtPoint(zoomFactor, pinchCenter)
        this.requestRender()
      } else {
        // 通常のスクロールでパン
        // 小さなデルタ値を無視（Macトラックパッドの誤差対策）
        const threshold = 0.5
        const deltaX = Math.abs(event.deltaX) > threshold ? -event.deltaX : 0
        const deltaY = Math.abs(event.deltaY) > threshold ? event.deltaY : 0

        if (deltaX !== 0 || deltaY !== 0) {
          this.pan(deltaX, deltaY)
          this.requestRender()
        }
      }
    })

    // タッチイベント（ピンチズーム）
    this.canvas.addEventListener('touchstart', (event) => {
      this.internalState.input.pointerCount = event.touches.length

      // debugState更新
      debugState.paplicoEngine.input.pointerCount = event.touches.length
      debugState.paplicoEngine.input.eventCount.touch++

      if (event.touches.length === 2) {
        this.internalState.input.isZooming = true
        debugState.paplicoEngine.input.isZooming = true
        this.handlePinchStart(event)
      }
    })

    this.canvas.addEventListener('touchmove', (event) => {
      event.preventDefault()

      if (this.internalState.input.isZooming && event.touches.length === 2) {
        this.handlePinchZoom(event)
      }
    })

    this.canvas.addEventListener('touchend', (event) => {
      this.internalState.input.pointerCount = event.touches.length

      if (event.touches.length < 2) {
        this.internalState.input.isZooming = false
      }
    })

    // キーボードショートカット
    window.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'Space':
          if (!event.repeat) {
            this.internalState.input.isPanning = true
            this.canvas.style.cursor = 'grab'
          }
          event.preventDefault()
          break
        case 'Digit0':
          if (event.ctrlKey || event.metaKey) {
            this.resetView()
            this.requestRender()
            event.preventDefault()
          }
          break
        case 'Equal':
        case 'NumpadAdd':
          if (event.ctrlKey || event.metaKey) {
            this.zoom(1.2)
            this.requestRender()
            event.preventDefault()
          }
          break
        case 'Minus':
        case 'NumpadSubtract':
          if (event.ctrlKey || event.metaKey) {
            this.zoom(0.8)
            this.requestRender()
            event.preventDefault()
          }
          break
        case 'Delete':
        case 'Backspace':
          this.handleDeleteKey()
          this.requestRender()
          event.preventDefault()
          break
      }
    })

    window.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'Space':
          this.internalState.input.isPanning = false
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
  private pinchCenterWorld: Vector2 = { x: 0, y: 0 }

  private handlePinchStart(event: TouchEvent): void {
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]

    this.pinchStartDistance = this.getTouchDistance(touch1, touch2)
    this.pinchStartZoom = this.state.camera.zoom
    this.pinchCenter = this.getTouchCenter(touch1, touch2)

    // ピンチ開始時の中心点の世界座標を保存
    this.pinchCenterWorld = this.screenToWorld(this.pinchCenter)
  }

  private handlePinchZoom(event: TouchEvent): void {
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]

    const currentDistance = this.getTouchDistance(touch1, touch2)
    const currentCenter = this.getTouchCenter(touch1, touch2)

    // ピンチ開始時からの距離の比率
    const scaleFactor = currentDistance / this.pinchStartDistance

    // 新しいズームレベル
    const newZoom = Math.max(
      0.1,
      Math.min(10, this.pinchStartZoom * scaleFactor),
    )

    // ズームを適用
    this.state.camera.zoom = newZoom

    // ズーム適用後に、同じ画面座標での世界座標を取得
    const newCenterWorld = this.screenToWorld(currentCenter)

    // 開始時の世界座標が現在のピンチ中心に来るように調整
    const offsetX = this.pinchCenterWorld.x - newCenterWorld.x
    const offsetY = this.pinchCenterWorld.y - newCenterWorld.y

    const _cameraBefore = { x: this.state.camera.x, y: this.state.camera.y }

    this.state.camera.x += offsetX
    this.state.camera.y += offsetY

    // 検証: 調整後に元の世界座標が正しい画面座標に戻るかチェック
    const _verifyWorld = this.screenToWorld(currentCenter)

    this.syncCameraWithState()
    this.requestRender()
  }

  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private getTouchCenter(touch1: Touch, touch2: Touch): Vector2 {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
      y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
    }
  }

  /**
   * パン操作
   */
  pan(deltaX: number, deltaY: number): void {
    this.state.camera.x -= deltaX / this.state.camera.zoom
    this.state.camera.y += deltaY / this.state.camera.zoom
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
    // ズーム前の世界座標を保存
    const worldPointBeforeZoom = this.screenToWorld(screenPoint)

    // ズームを適用
    const oldZoom = this.state.camera.zoom
    this.state.camera.zoom = Math.max(0.1, Math.min(10, oldZoom * factor))

    // ズーム後の同じ画面座標に対応する世界座標を計算
    const worldPointAfterZoom = this.screenToWorld(screenPoint)

    // 差分だけカメラを移動してズーム中心を維持
    const offsetX = worldPointBeforeZoom.x - worldPointAfterZoom.x
    const offsetY = worldPointBeforeZoom.y - worldPointAfterZoom.y

    this.state.camera.x += offsetX
    this.state.camera.y += offsetY

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
    // 論理ピクセル座標をそのまま使用（DPRは適用しない）
    return this.camera.screenToWorld(
      screenPoint.x,
      screenPoint.y,
      this.canvas.style.width
        ? parseInt(this.canvas.style.width)
        : this.canvas.width,
      this.canvas.style.height
        ? parseInt(this.canvas.style.height)
        : this.canvas.height,
    )
  }

  /**
   * 世界座標を画面座標に変換
   */
  worldToScreen(worldPoint: Vector2): Vector2 {
    // 論理ピクセル座標を返す
    return this.camera.worldToScreen(
      worldPoint.x,
      worldPoint.y,
      this.canvas.style.width
        ? parseInt(this.canvas.style.width)
        : this.canvas.width,
      this.canvas.style.height
        ? parseInt(this.canvas.style.height)
        : this.canvas.height,
    )
  }

  /**
   * カメラステートを同期
   */
  private syncCameraWithState(): void {
    this.camera.setPosition(this.state.camera.x, this.state.camera.y)
    this.camera.setZoom(this.state.camera.zoom)
    this.camera.setRotation(this.state.camera.rotation)

    // WebGPUEngineのカメラも更新
    this.webgpuEngine.updateCamera(
      this.state.camera.x,
      this.state.camera.y,
      this.state.camera.zoom,
      this.state.camera.rotation,
    )

    // エンジンステートも更新
    this.webgpuEngine.state.viewport.x = this.state.camera.x
    this.webgpuEngine.state.viewport.y = this.state.camera.y
    this.webgpuEngine.state.viewport.zoom = this.state.camera.zoom
    this.webgpuEngine.state.viewport.rotation = this.state.camera.rotation

    // debugState更新
    this.updateDebugCameraState()
  }

  /**
   * 配置ガイド情報を更新
   */
  private updateAlignmentGuides(): void {
    const document = this.documentManager.activeDocument
    if (!document) {
      this.state.alignment.objects = []
      this.state.alignment.vertical = []
      this.state.alignment.horizontal = []
      return
    }

    const objects: ObjectBounds[] = []

    // ドキュメント内の全アートオブジェクトから配置情報を取得
    for (const [id, artObject] of Object.entries(document.artObjects)) {
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
      const documentId = this.state.activeDocumentId
      const activeDocumentContext =
        this.documentManager.getDocumentContext(documentId)

      if (!activeDocumentContext) {
        this.animationId = requestAnimationFrame(render)
        return
      }

      const currentTime = performance.now()
      const timeSinceLastRender = currentTime - this.lastRenderTime

      // レンダリングが必要かチェック
      if (this.needsRender || timeSinceLastRender > this.renderCheckInterval) {
        // レンダリング開始時刻を記録
        const renderStartTime = performance.now()

        // デバッグ: レンダリング前の状態
        if (this.webgpuEngine.state.currentStroke) {
          debugState.paplicoEngine.renderLoop = {
            beforeRender: {
              hasCurrentStroke: true,
              pointsLength: this.webgpuEngine.state.currentStroke.points.length,
              isDrawing: this.webgpuEngine.state.isDrawing,
              needsRender: this.needsRender,
              timeSinceLastRender,
              timestamp: Date.now(),
            },
          }
        }

        this.webgpuEngine.render(activeDocumentContext)

        // アライメントガイドは選択中のオブジェクトがある場合のみ更新
        if (selectionState.selectedObjects.size > 0) {
          this.updateAlignmentGuides()
        }

        // レンダリング終了時刻を記録し、パフォーマンス情報を更新
        const renderEndTime = performance.now()
        this.updatePerformanceMetrics(
          renderStartTime,
          renderEndTime,
          currentTime,
        )

        this.lastRenderTime = currentTime
        this.needsRender = false
      }

      this.animationId = requestAnimationFrame(render)
    }

    render()
  }

  /**
   * レンダリングをリクエスト
   */
  public requestRender(reason?: string): void {
    this.needsRender = true

    // debugStateを更新
    debugState.paplicoEngine.renderOptimization.needsRender = true
    debugState.paplicoEngine.renderOptimization.renderRequestCount++
    debugState.paplicoEngine.renderOptimization.lastRenderReason =
      reason || 'manual'

    // ストローク関連のrequestRenderを追跡
    if (this.webgpuEngine.state.currentStroke) {
      debugState.paplicoEngine.renderOptimization.strokeRenderRequests =
        (debugState.paplicoEngine.renderOptimization.strokeRenderRequests ||
          0) + 1
      debugState.paplicoEngine.renderOptimization.lastStrokeRenderRequest = {
        reason,
        hasCurrentStroke: true,
        pointsLength: this.webgpuEngine.state.currentStroke.points.length,
        isDrawing: this.webgpuEngine.state.isDrawing,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * リサイズ処理
   */
  resize(width: number, height: number): void {
    this.state.viewport.width = width
    this.state.viewport.height = height
    this.webgpuEngine.resize(width, height)
    this.requestRender()
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
   * WebGPUEngineのステートを取得（UI層からのアクセス用）
   */
  getEngineState() {
    return this.webgpuEngine.state
  }

  /**
   * ブラシ設定を更新
   */
  setBrushConfig(config: any): void {
    this.webgpuEngine.setBrushConfig(config)
  }

  /**
   * アクティブツールを設定
   */
  setActiveTool(
    tool: 'brush' | 'select' | 'move' | 'pan' | 'vertexSelect' | 'vertexEdit',
  ): void {
    this.state.tools.activeTool = tool
  }

  /**
   * アクティブレイヤーを設定
   */
  setActiveLayer(layerId: UUID): boolean {
    const activeDocument = this.documentManager.activeDocument
    if (!activeDocument || !activeDocument.layers[layerId]) {
      return false
    }

    activeDocument.activeLayerId = layerId
    activeDocument.updatedAt = new Date()
    return true
  }

  /**
   * アクティブレイヤーを取得
   */
  getActiveLayer() {
    const activeDocument = this.documentManager.activeDocument
    if (!activeDocument || !activeDocument.activeLayerId) {
      return null
    }

    return activeDocument.layers[activeDocument.activeLayerId] || null
  }

  /**
   * 選択・移動機能のハンドラーを設定
   */
  private setupSelectionMoveHandlers(): void {
    // 選択状態システムに実際のオブジェクト移動機能を統合
    setExternalMoveObjectsFunction((objectIds: string[], offset: Vector2) => {
      this.moveObjectsCommand(objectIds, offset)
    })
  }

  /**
   * オブジェクト移動コマンドを実行
   */
  private moveObjectsCommand(objectIds: string[], offset: Vector2): void {
    if (objectIds.length === 0) return

    // debugStateに移動コマンド実行を記録
    debugState.movement.executionLog.push({
      timestamp: Date.now(),
      action: 'execute_command',
      data: {
        source: 'PaplicoEngine.moveObjectsCommand',
        objectIds: [...objectIds],
        offset: { ...offset },
      },
    })

    const moveCommand = new MoveArtObjectsCommand(
      {
        artObjectIds: objectIds,
        offset,
      },
      this.documentManager,
    )

    // コマンドを実行してヒストリーに記録
    const success = this.documentManager.executeCommand(moveCommand)

    // debugStateに実行結果を記録
    debugState.movement.executionLog.push({
      timestamp: Date.now(),
      action: 'execute_command',
      data: {
        source: 'DocumentManager.executeCommand',
        success: success,
        commandId: moveCommand.id,
      },
    })
  }

  /**
   * Deleteキーによるオブジェクト削除処理
   */
  private handleDeleteKey(): void {
    // 選択されたオブジェクトのIDを取得
    const selectedObjectIds = Array.from(selectionState.selectedObjects)

    if (selectedObjectIds.length === 0) {
      return // 何も選択されていない場合は何もしない
    }

    // 削除コマンドを作成して実行
    const deleteCommand = new DeleteArtObjectsCommand(
      {
        artObjectIds: selectedObjectIds,
      },
      this.documentManager,
    )

    // コマンドを実行してヒストリーに記録
    this.documentManager.executeCommand(deleteCommand)

    // 選択状態をクリア
    clearSelection()

    // UIComponentManagerの選択状態もクリア
    this.webgpuEngine.getUIManager()?.clearSelection()
  }

  /**
   * ドキュメントマネージャーのイベントハンドラーを設定
   */
  private setupDocumentManagerHandlers(): void {
    this.documentManager.on(
      'activeDocumentChanged',
      (event: DocumentManagerChangeEvent) => {
        if (event.type === 'active-document-changed') {
          // アクティブドキュメントが変更された時にPaplicoStateを更新
          this.state.activeDocumentId = event.documentId

          // WebGPUEngineのstateにもドキュメントを同期
          this.syncDocumentToWebGPUState()

          // アライメントガイドを更新
          this.updateAlignmentGuides()

          // レンダリングをリクエスト
          this.requestRender()
        }
      },
    )

    // ドキュメントが作成された時の処理
    this.documentManager.on(
      'documentCreated',
      (event: DocumentManagerChangeEvent) => {
        if (event.type === 'document-created') {
          // WebGPUEngineのstateにドキュメントを同期
          this.syncDocumentToWebGPUState()

          // レンダリングをリクエスト
          this.requestRender()
        }
      },
    )
  }

  /**
   * DocumentManagerのアクティブドキュメントをWebGPUEngineのstateに同期
   */
  private syncDocumentToWebGPUState(): void {
    const activeDocument = this.documentManager.activeDocument
    if (activeDocument) {
      // WebGPUEngineのstateにドキュメントを設定
      this.webgpuEngine.state.document = activeDocument
    }

    // debugStateを更新
    this.updateDebugDocumentState()
  }

  // === ドキュメント管理API ===

  getDocument(documentId: UUID): CreateDocumentParams | null {
    return this.documentManager.getDocument(documentId)
  }

  /**
   * アクティブドキュメントを取得
   */
  getActiveDocument() {
    return this.documentManager.activeDocument
  }

  /**
   * アクティブドキュメントのコンテキストを取得
   */
  getActiveDocumentContext() {
    return this.documentManager.getDocumentContext(this.state.activeDocumentId)
  }

  /**
   * アクティブドキュメントを設定
   */
  setActiveDocument(documentId: UUID | null): boolean {
    return this.documentManager.setActiveDocument(documentId)
  }

  // === ヒストリー管理API ===

  /**
   * コマンドを実行
   */
  executeCommand(command: ICommand): boolean {
    return this.documentManager.executeCommand(command)
  }

  /**
   * Undo操作
   */
  undo(): boolean {
    const result = this.documentManager.undo()
    if (result) this.requestRender()
    return result
  }

  /**
   * Redo操作
   */
  redo(): boolean {
    const result = this.documentManager.redo()
    if (result) this.requestRender()
    return result
  }

  /**
   * ヒストリー状態を取得
   */
  getHistoryState(documentId?: UUID) {
    const targetId = documentId || this.state.activeDocumentId
    if (!targetId) return null
    return this.documentManager.getHistoryState(targetId)
  }

  /**
   * アクティブドキュメントのヒストリー変更リスナーを追加
   */
  addHistoryChangeListener(listener: (event: any) => void): void {
    const context = this.documentManager.getDocumentContext(
      this.state.activeDocumentId,
    )
    if (context) {
      context.history.addChangeListener(listener)
    }
  }

  /**
   * アクティブドキュメントのヒストリー変更リスナーを削除
   */
  removeHistoryChangeListener(listener: (event: any) => void): void {
    const context = this.documentManager.getDocumentContext(
      this.state.activeDocumentId,
    )
    if (context) {
      context.history.removeChangeListener(listener)
    }
  }

  /**
   * ドキュメントを保存済みとしてマーク
   */
  markDocumentAsSaved(documentId?: UUID): void {
    const targetId = documentId || this.documentManager.activeDocument?.id
    if (targetId) {
      this.documentManager.markDocumentAsSaved(targetId)
    }
  }

  /**
   * ドキュメントマネージャーを取得
   */
  getDocumentManager(): DocumentManager {
    return this.documentManager
  }

  /**
   * 指定されたドキュメントを保存
   */
  saveDocument(
    documentId: UUID,
    options?: SerializationOptions,
  ): Uint8Array | null {
    const context = this.documentManager.getDocumentContext(documentId)
    if (!context) return null

    return DocumentSerializer.serialize(context.document, options)
  }

  /**
   * ドキュメントを読み込む
   */
  loadDocument(data: Uint8Array, _options?: SerializationOptions): UUID | null {
    const document = DocumentSerializer.deserialize(data)
    if (!document) return null

    const documentId = this.documentManager.loadDocument(document.document)

    return documentId
  }

  /**
   * 描画開始処理
   */
  private handleDrawingStart(event: EnhancedPointerEvent): void {
    // デバッグ: 描画開始時の状態を記録
    debugState.paplicoEngine.handleDrawingStart = {
      called: true,
      isDrawingBefore: this.webgpuEngine.state.isDrawing,
      hasCurrentStrokeBefore: !!this.webgpuEngine.state.currentStroke,
      timestamp: Date.now(),
    }

    // 前のストロークが残っている場合は強制終了
    if (
      this.webgpuEngine.state.isDrawing ||
      this.webgpuEngine.state.currentStroke
    ) {
      console.warn('Previous stroke was not properly ended, forcing cleanup')
      this.webgpuEngine.endDrawing(null)
    }

    // Canvas座標からワールド座標に変換
    const worldPos = this.screenToWorld({ x: event.x, y: event.y })

    // pressure、tilt、velocityデータを含むVector2を作成
    const enhancedPoint: Vector2 = {
      x: worldPos.x,
      y: worldPos.y,
      pressure: event.pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      velocity: event.velocity,
      timestamp: event.timestamp,
    }

    // 新しいベクターパスを作成
    const vectorPath = createVectorPath([enhancedPoint])

    // 描画開始
    this.webgpuEngine.startDrawing(vectorPath)

    // デバッグ: 描画開始後の状態を記録
    debugState.paplicoEngine.handleDrawingStartAfter = {
      isDrawingAfter: this.webgpuEngine.state.isDrawing,
      hasCurrentStrokeAfter: !!this.webgpuEngine.state.currentStroke,
      currentStrokePoints:
        this.webgpuEngine.state.currentStroke?.points?.length || 0,
    }

    this.requestRender()
  }

  /**
   * 描画移動処理
   */
  private handleDrawingMove(event: EnhancedPointerEvent): void {
    if (!this.webgpuEngine.state.currentStroke) return

    // Canvas座標からワールド座標に変換
    const worldPos = this.screenToWorld({ x: event.x, y: event.y })

    // pressure、tilt、velocityデータを含むVector2を作成
    const enhancedPoint: Vector2 = {
      x: worldPos.x,
      y: worldPos.y,
      pressure: event.pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      velocity: event.velocity,
      timestamp: event.timestamp,
    }

    // 現在のストロークにポイントを追加
    this.webgpuEngine.addPointToCurrentStroke(enhancedPoint)
    this.requestRender()
  }

  /**
   * 描画終了処理
   */
  private handleDrawingEnd(_event: EnhancedPointerEvent): void {
    // debugStateに記録
    debugState.paplicoEngine.handleDrawingEnd = {
      called: true,
      hasCurrentStroke: !!this.webgpuEngine.state.currentStroke,
      activeDocumentId: this.state.activeDocumentId,
      timestamp: Date.now(),
    }

    if (!this.webgpuEngine.state.currentStroke) {
      debugState.paplicoEngine.handleDrawingEnd.returnReason =
        'No current stroke'
      // ストロークがなくても描画状態をクリア
      this.webgpuEngine.endDrawing(null)
      return
    }
    if (!this.state.activeDocumentId) {
      debugState.paplicoEngine.handleDrawingEnd.returnReason =
        'No active document'
      // ドキュメントがなくても描画状態をクリア
      this.webgpuEngine.endDrawing(null)
      return
    }

    // 描画終了（パスをレイヤーに追加）
    const document = this.documentManager.getDocument(
      this.state.activeDocumentId,
    )

    if (!document) {
      debugState.paplicoEngine.handleDrawingEnd.returnReason =
        'Document not found'
      // ドキュメントが見つからなくても描画状態をクリア
      this.webgpuEngine.endDrawing(null)
      return
    }

    let vectorLayer = null

    if (document.activeLayerId) {
      const activeLayer = document.layers[document.activeLayerId]
      if (activeLayer && activeLayer.type === 'vector') {
        vectorLayer = activeLayer
      }
    }

    if (!vectorLayer) {
      vectorLayer = Object.values(document.layers).find(
        (layer) => layer.type === 'vector',
      )
    }

    if (vectorLayer) {
      // WebGPUEngineから実際のストロークデータを取得
      const currentStroke = this.webgpuEngine.state.currentStroke

      if (currentStroke && currentStroke.points.length > 0) {
        const { strokeSettings: brushConfig } = this.webgpuEngine.state
        // ドキュメントに追加するコマンドを実行
        const strokeParams = getStrokeParams(this.webgpuEngine.state)
        const artObject = createPathArtObject({
          layerId: vectorLayer.id,
          path: currentStroke,
          appearances: [createStrokeAppearance(strokeParams)],
        })

        // デバッグ: 一時IDから永続IDへの遷移を記録
        const currentTempId = this.webgpuEngine.getCurrentTempStrokeId()
        debugState.stroke.tempStrokeTransition = {
          debugToken: `temp-to-permanent-transition-v1-${crypto.randomUUID()}`,
          timestamp: new Date().toISOString(),
          action: 'save_transition',
          previousTempStrokeId: currentTempId,
          currentStrokePoints: currentStroke.points.length,
          isDrawing: this.webgpuEngine.state.isDrawing,
          newPermanentId: artObject.id,
          layerId: vectorLayer.id,
          strokeParams: {
            width: strokeParams.width,
            brushTexture: strokeParams.brushSettings?.texture,
            scatterCount: strokeParams.brushSettings?.scatterConfig?.count,
          },
        } as any

        // デバッグ: 保存前のアートオブジェクト
        debugState.paplicoEngine.savingArtObject = {
          debugToken: `saving-art-object-v1-${crypto.randomUUID()}`,
          tempId: currentTempId,
          permanentId: artObject.id,
          layerId: artObject.layerId,
          type: artObject.type,
          pointCount: artObject.path?.points?.length || 0,
          appearances: artObject.appearances?.length || 0,
          strokeSettings: {
            width: this.webgpuEngine.state.strokeSettings.width,
            color: this.webgpuEngine.state.strokeSettings.color,
            brushTexture:
              this.webgpuEngine.state.strokeSettings.brushSettings?.texture,
            scatterCount:
              this.webgpuEngine.state.strokeSettings.brushSettings
                ?.scatterConfig?.count,
          },
          strokeParams: {
            width: strokeParams.width,
            color: strokeParams.color,
            brushSettingsExists: !!strokeParams.brushSettings,
          },
          firstAppearance: artObject.appearances[0]
            ? {
                effectId: artObject.appearances[0].effectId,
                enabled: artObject.appearances[0].enabled,
                hasParams: !!artObject.appearances[0].params,
                params: artObject.appearances[0].params,
              }
            : null,
          visible: artObject.visible,
          strokeParams: {
            width: strokeParams.width,
            hasBrushSettings: !!strokeParams.brushSettings,
            brushTexture: strokeParams.brushSettings?.texture,
            scatterCount: strokeParams.brushSettings?.scatterConfig?.count,
          },
          timestamp: Date.now(),
        }

        // デバッグ: 保存時のブラシ設定をdebugStateに記録
        this.webgpuEngine.debugState.stroke.strokeSaveData = {
          debugToken: `stroke-save-v1-${crypto.randomUUID()}`,
          timestamp: new Date().toISOString(),
          action: 'save_stroke',
          artObjectId: artObject.id,
          strokeParams: {
            width: strokeParams.width,
            hasBrushSettings: !!strokeParams.brushSettings,
            brushTexture: strokeParams.brushSettings?.texture,
            scatterCount: strokeParams.brushSettings?.scatterConfig?.count,
            spread: strokeParams.brushSettings?.scatterConfig?.spread,
          },
          appearanceParams: artObject.appearances.map((a: any) => ({
            effectId: a.effectId,
            enabled: a.enabled,
            width: a.params?.width,
            hasBrushSettings: !!a.params?.brushSettings,
            brushTexture: a.params?.brushSettings?.texture,
            scatterCount: a.params?.brushSettings?.scatterConfig?.count,
          })),
        }

        const addCommand = new AddArtObjectCommand({
          artObjectId: artObject.id,
          artObjectData: artObject,
        })

        // ドキュメントとレイヤー状態を確認
        const _beforeExecute = {
          activeDocumentId: this.documentManager.activeDocumentId,
          totalArtObjects: Object.keys(document.artObjects).length,
          vectorLayer: vectorLayer
            ? {
                id: vectorLayer.id,
                artObjectCount: vectorLayer.artObjectIds.length,
              }
            : null,
        }

        const success = this.documentManager.executeCommand(addCommand)

        // デバッグ: コマンド実行結果
        const debugData = {
          debugToken: `paplico-stroke-save-v1-${crypto.randomUUID()}`,
          timestamp: new Date().toISOString(),
          action: 'stroke_saved',
          success,
          artObject: {
            id: artObject.id,
            layerId: artObject.layerId,
            type: artObject.type,
            pointCount: artObject.path?.points?.length || 0,
            appearances: artObject.appearances?.map((a) => ({
              type: a.effectId,
              enabled: a.enabled,
              params:
                a.effectId === 'stroke'
                  ? {
                      width: (a as any).params.width,
                      color: (a as any).params.color,
                      brushSettings: (a as any).params.brushSettings,
                    }
                  : {},
            })),
          },
          document: {
            id: document.id,
            artObjectsCount: Object.keys(document.artObjects).length,
            artObjectIds: Object.keys(document.artObjects),
            layerInfo: {
              id: vectorLayer?.id,
              type: vectorLayer?.type,
              artObjectIds: (vectorLayer as any)?.artObjectIds || [],
            },
          },
        }

        // デバッグ情報をdebugStateに記録
        debugState.paplicoEngine.commandExecutionResult = debugData

        // デバッグ情報をdebugStateに保存
        debugState.stroke.strokeSaveData = debugData

        // 実行後の状態を確認
        const _afterExecute = {
          totalArtObjects: Object.keys(document.artObjects).length,
          vectorLayer: vectorLayer
            ? {
                id: vectorLayer.id,
                artObjectCount: vectorLayer.artObjectIds.length,
              }
            : null,
        }
      }
    }

    // デバッグ: ストローク保存後のレンダリングタイミングを記録
    debugState.paplicoEngine.beforeEndDrawing = {
      hasCurrentStroke: !!this.webgpuEngine.state.currentStroke,
      currentStrokePoints:
        this.webgpuEngine.state.currentStroke?.points?.length || 0,
      isDrawing: this.webgpuEngine.state.isDrawing,
      savedArtObjectId: artObject?.id,
      timestamp: Date.now(),
    }

    // WebGPUエンジンの描画終了処理
    this.webgpuEngine.endDrawing(document)

    // デバッグ: endDrawing後の状態
    debugState.paplicoEngine.afterEndDrawing = {
      hasCurrentStroke: !!this.webgpuEngine.state.currentStroke,
      isDrawing: this.webgpuEngine.state.isDrawing,
      willRequestRender: true,
      timestamp: Date.now(),
    }

    this.requestRender()
  }

  /**
   * 選択ツールの開始処理
   */
  private handleSelectionStart(event: EnhancedPointerEvent): void {
    // カメラ状態を強制同期
    this.syncCameraWithState()

    const worldPos = this.webgpuEngine.canvasToWorld(event.x, event.y)
    const isMultiSelect = (event.originalEvent as PointerEvent).shiftKey

    // 新しいレイキャスト機能を使用してヒットテスト
    const documentContext = this.documentManager.getDocumentContext(
      this.documentManager.activeDocument?.id || null,
    )

    if (!documentContext) {
      console.warn('No document context found for selection')
      return
    }

    // UIComponentManagerのレイキャスト機能を使用
    const raycastHits = this.webgpuEngine.raycast(
      event.x,
      event.y,
      documentContext,
    )

    // ヒットしたオブジェクトがある場合
    if (raycastHits.length > 0) {
      const closestHit = raycastHits[0] // 最も近いオブジェクト
      const hitId = closestHit.artObject.id

      if (this.state.tools.activeTool === 'vertexSelect') {
        // 頂点選択モード（将来の拡張用）
        selectVertex(hitId, isMultiSelect)
      } else {
        // オブジェクト選択モード
        if (isMultiSelect) {
          toggleObjectSelection(hitId)
        } else {
          selectObject(hitId, false)
        }
      }

      // UIComponentManagerの選択状態も同期
      const selectedIds = Array.from(selectionState.selectedObjects)
      this.webgpuEngine.getUIManager()?.clearSelection()
      if (selectedIds.length > 0) {
        this.webgpuEngine.getUIManager()?.updateSelectionFromHitTest(
          selectedIds.map((id) => ({
            artObject: { id },
            boundingBox: closestHit.boundingBox,
          })),
        )
      }

      // 選択されたオブジェクトの内側からドラッグが開始された場合は移動を開始
      if (
        this.state.tools.activeTool === 'move' ||
        (this.state.tools.activeTool === 'select' &&
          selectionState.selectedObjects.has(hitId))
      ) {
        startDrag(worldPos)
      }
    } else {
      // オブジェクトがヒットしなかった場合
      if (this.state.tools.activeTool === 'select') {
        // 矩形選択開始
        startDragSelection(worldPos)
      } else if (!isMultiSelect) {
        clearSelection()
        // UIComponentManagerの選択状態もクリア
        this.webgpuEngine.getUIManager()?.clearSelection()
      }
    }
  }

  /**
   * 選択ツールの移動処理
   */
  private handleSelectionMove(event: EnhancedPointerEvent): void {
    // カメラ状態を強制同期
    this.syncCameraWithState()

    const worldPos = this.webgpuEngine.canvasToWorld(event.x, event.y)

    if (selectionState.isDragging) {
      updateDrag(worldPos)
      this.requestRender()
    } else if (selectionState.isDragSelecting) {
      updateDragSelection(worldPos)
      this.requestRender()
    }
  }

  /**
   * 選択ツールの終了処理
   */
  private handleSelectionEnd(event: EnhancedPointerEvent): void {
    const isMultiSelect = (event.originalEvent as PointerEvent).shiftKey

    if (selectionState.isDragging) {
      endDrag()
      this.requestRender()
    } else if (selectionState.isDragSelecting) {
      // カスタムドラッグ選択終了処理
      this.endDragSelectionWithRaycast(isMultiSelect)
      this.requestRender()
    }
  }

  /**
   * レイキャストを使った矩形選択終了処理
   */
  private endDragSelectionWithRaycast(multiSelect: boolean): void {
    if (!selectionState.isDragSelecting || !selectionState.dragSelectionBox) {
      clearDragSelection()
      return
    }

    const documentContext = this.documentManager.getDocumentContext(
      this.documentManager.activeDocument?.id || null,
    )
    if (!documentContext) {
      console.warn('🎯 No document context found for drag selection')
      clearDragSelection()
      return
    }

    const document = documentContext.document
    const selectionBox = selectionState.dragSelectionBox

    // 選択ボックス内のオブジェクトを検索
    const objectsInSelection: string[] = []

    // ドキュメント内の全ArtObjectをチェック
    for (const [artObjectId, artObject] of Object.entries(
      document.artObjects,
    )) {
      if (!artObject.visible) continue

      // オブジェクトのバウンディングボックスと選択範囲の交差判定
      let objectBounds: { x: number; y: number; width: number; height: number }

      if (artObject.type === 'path' && artObject.path?.points) {
        // PathArtObjectのバウンディングボックス計算
        const points = artObject.path.points
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity

        for (const point of points) {
          minX = Math.min(minX, point.x)
          minY = Math.min(minY, point.y)
          maxX = Math.max(maxX, point.x)
          maxY = Math.max(maxY, point.y)
        }

        objectBounds = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      } else if (artObject.type === 'canvas') {
        // CanvasArtObjectのバウンディングボックス計算
        const transform = artObject.transform
        objectBounds = {
          x: transform.x,
          y: transform.y,
          width: artObject.width * (transform.scaleX || 1),
          height: artObject.height * (transform.scaleY || 1),
        }
      } else {
        continue
      }

      // 矩形交差判定
      const intersects = !(
        objectBounds.x + objectBounds.width < selectionBox.x ||
        objectBounds.x > selectionBox.x + selectionBox.width ||
        objectBounds.y + objectBounds.height < selectionBox.y ||
        objectBounds.y > selectionBox.y + selectionBox.height
      )

      if (intersects) {
        objectsInSelection.push(artObjectId)
      }
    }

    // 選択を更新
    if (!multiSelect) {
      clearSelection()
    }

    for (const objectId of objectsInSelection) {
      selectionState.selectedObjects.add(objectId)
    }

    clearDragSelection()
  }

  /**
   * ホバー時のヒットテストを実行（簡略版）
   */
  private performHoverHitTest(event: EnhancedPointerEvent): void {
    const documentContext = this.documentManager.getDocumentContext(
      this.documentManager.activeDocument?.id || null,
    )
    if (!documentContext) return

    // ホバー時は簡潔なログのみ
    const hits = this.webgpuEngine.hitTest(event.x, event.y, documentContext)

    if (hits.length > 0) {
      const _closestHit = hits[0]

      // カーソルを変更
      this.canvas.style.cursor = 'pointer'
    } else {
      // カーソルをデフォルトに戻す
      this.canvas.style.cursor =
        this.state.tools.activeTool === 'select' ? 'crosshair' : 'move'
    }
  }

  /**
   * 頂点編集ツールの開始処理
   */
  private handleVertexEditStart(event: EnhancedPointerEvent): void {
    const documentContext = this.documentManager.getDocumentContext(
      this.documentManager.activeDocument?.id || null,
    )
    if (!documentContext) {
      console.warn('No document context found for vertex editing')
      return
    }

    // UIComponentManagerから頂点編集ツールを取得
    const uiComponentManager = this.webgpuEngine.getUIComponentManager()
    const vertexEditTool = uiComponentManager?.getVertexEditTool()
    if (!uiComponentManager || !vertexEditTool) {
      console.warn('Vertex edit tool not initialized')
      return
    }

    // ワールド座標に変換
    const worldPos = this.webgpuEngine.canvasToWorld(event.x, event.y)

    // 頂点編集ツールにドキュメントコンテキストを設定
    vertexEditTool.setDocumentContext(documentContext)

    // マウスダウン処理を実行
    const handled = vertexEditTool.onMouseDown(
      worldPos,
      event.originalEvent as PointerEvent,
    )

    if (handled) {
      // 処理された場合はカーソルを変更
      this.canvas.style.cursor = 'grab'
      this.requestRender()
    }
  }

  /**
   * 頂点編集ツールの移動処理
   */
  private handleVertexEditMove(event: EnhancedPointerEvent): void {
    const uiComponentManager = this.webgpuEngine.getUIComponentManager()
    const vertexEditTool = uiComponentManager?.getVertexEditTool()
    if (!uiComponentManager || !vertexEditTool) {
      return
    }

    // ワールド座標に変換
    const worldPos = this.webgpuEngine.canvasToWorld(event.x, event.y)

    // マウス移動処理を実行
    const handled = vertexEditTool.onMouseMove(worldPos)

    if (handled) {
      // ドラッグ中はカーソルを変更
      this.canvas.style.cursor = 'grabbing'
      this.requestRender()
    } else {
      // ホバー時のカーソル変更など
      this.canvas.style.cursor = 'default'
    }
  }

  /**
   * 頂点編集ツールの終了処理
   */
  private handleVertexEditEnd(_event: EnhancedPointerEvent): void {
    const uiComponentManager = this.webgpuEngine.getUIComponentManager()
    const vertexEditTool = uiComponentManager?.getVertexEditTool()
    if (!uiComponentManager || !vertexEditTool) {
      return
    }

    // マウスアップ処理を実行
    vertexEditTool.onMouseUp()

    // カーソルをデフォルトに戻す
    this.canvas.style.cursor = 'default'
    this.requestRender()
  }

  /**
   * ヒットテストを実行してデバッグ情報に記録
   */
  private performHitTest(event: EnhancedPointerEvent): void {
    const documentContext = this.documentManager.getDocumentContext(
      this.documentManager.activeDocument?.id || null,
    )
    if (!documentContext) {
      console.warn('🎯 No document context found for hit test')
      // debugStateにエラー情報を記録
      debugState.hitTest.lastTest = {
        timestamp: Date.now(),
        screenPosition: { x: event.x, y: event.y },
        worldPosition: { x: 0, y: 0 },
        hits: [],
        raycastHits: [],
        documentAvailable: false,
        error: 'No document context found',
      }
      return
    }

    // レガシーヒットテストとレイキャストヒットテストの両方を実行
    const legacyHits = this.webgpuEngine.hitTest(
      event.x,
      event.y,
      documentContext,
    )
    const raycastHits = this.webgpuEngine.raycast(
      event.x,
      event.y,
      documentContext,
    )

    // ワールド座標を計算
    const worldPos = this.screenToWorld({ x: event.x, y: event.y })

    // debugStateにヒットテスト結果を記録
    debugState.hitTest.lastTest = {
      timestamp: Date.now(),
      screenPosition: { x: event.x, y: event.y },
      worldPosition: { x: worldPos.x, y: worldPos.y },
      hits: legacyHits.map((hit) => ({
        artObjectId: hit.artObject?.id || 'unknown',
        artObjectType: hit.artObject?.type || 'unknown',
        distance: hit.distance || 0,
        layerId: hit.artObject?.layerId || 'unknown',
      })),
      raycastHits: raycastHits.map((hit) => ({
        artObjectId: hit.artObject?.id || 'unknown',
        artObjectType: hit.artObject?.type || 'unknown',
        distance: hit.distance || 0,
        layerId: hit.artObject?.layerId || 'unknown',
        boundingBox: hit.boundingBox || null,
      })),
      documentAvailable: true,
      hitCount: legacyHits.length,
      raycastHitCount: raycastHits.length,
    }

    // 統計情報を更新（hitTest統計はdebugState.hitTestで追跡）
    debugState.hitTest.hitCount++
  }

  /**
   * パスの境界を計算
   */
  private calculatePathBounds(
    points: any[],
  ): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (!points || points.length === 0) return null

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    for (const point of points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    return { minX, minY, maxX, maxY }
  }

  /**  ドキュメントをエクスポート */
  async export(strategy: IExporterStrategy, documentId: UUID): Promise<File[]> {
    const activeDocumentContext =
      this.documentManager.getDocumentContext(documentId)
    if (!activeDocumentContext) {
      throw new Error('No active document available for export')
    }
    const files = await strategy.export(activeDocumentContext, this)

    return files
  }

  /**
   * WebGPUEngineへのアクセス
   */
  getEngine(): WebGPUEngine {
    return this.webgpuEngine
  }

  /**
   * debugStateの入力情報を更新
   */
  private updateDebugInputState(): void {
    debugState.paplicoEngine.input.currentTool = this.state.tools.activeTool
    debugState.paplicoEngine.input.isMouseDown =
      this.internalState.input.isMouseDown
    debugState.paplicoEngine.input.isPanning =
      this.internalState.input.isPanning
    debugState.paplicoEngine.input.isZooming =
      this.internalState.input.isZooming
    debugState.paplicoEngine.input.pointerCount =
      this.internalState.input.pointerCount
  }

  /**
   * debugStateのカメラ情報を更新
   */
  private updateDebugCameraState(): void {
    debugState.paplicoEngine.camera.position = {
      x: this.state.camera.x,
      y: this.state.camera.y,
    }
    debugState.paplicoEngine.camera.zoom = this.state.camera.zoom
    debugState.paplicoEngine.camera.rotation = this.state.camera.rotation
    debugState.paplicoEngine.camera.viewport = {
      width: this.state.viewport.width,
      height: this.state.viewport.height,
    }
    debugState.paplicoEngine.camera.transformationCount++
    debugState.paplicoEngine.camera.lastTransformTimestamp = Date.now()
  }

  /**
   * debugStateのドキュメント情報を更新
   */
  private updateDebugDocumentState(): void {
    const activeDocument = this.documentManager.activeDocument
    debugState.paplicoEngine.document.activeDocumentId =
      this.state.activeDocumentId
    debugState.paplicoEngine.document.layerCount = activeDocument
      ? Object.keys(activeDocument.layers).length
      : 0
    debugState.paplicoEngine.document.artObjectCount = activeDocument
      ? Object.keys(activeDocument.artObjects).length
      : 0
    debugState.paplicoEngine.document.artboardCount = activeDocument
      ? Object.keys(activeDocument.artboards).length
      : 0
    debugState.paplicoEngine.document.lastModified = Date.now()
    debugState.paplicoEngine.document.documentChanges++
  }

  /**
   * パフォーマンスメトリクスを更新
   */
  private updatePerformanceMetrics(
    renderStartTime: number,
    renderEndTime: number,
    currentTime: number,
  ): void {
    const renderDuration = renderEndTime - renderStartTime
    const frameTime = currentTime - this.lastRenderTime

    // 累積レンダリング時間を更新
    this.totalRenderTimeAccumulator += renderDuration
    debugState.paplicoEngine.performance.totalRenderTime =
      this.totalRenderTimeAccumulator

    // フレーム時間のサンプルを記録
    if (this.lastRenderTime > 0) {
      // 初回フレームは除外
      this.frameTimeSamples.push(frameTime)

      // サンプル数を制限
      if (this.frameTimeSamples.length > this.maxFrameTimeSamples) {
        this.frameTimeSamples.shift()
      }

      // 平均フレーム時間を計算
      const averageFrameTime =
        this.frameTimeSamples.reduce((sum, time) => sum + time, 0) /
        this.frameTimeSamples.length
      debugState.paplicoEngine.performance.averageFrameTime = averageFrameTime
    }

    // メモリ使用量の概算（可能な範囲で）
    this.updateMemoryUsageMetrics()
  }

  /**
   * メモリ使用量メトリクスを更新
   */
  private updateMemoryUsageMetrics(): void {
    try {
      // performance.memory API（Chrome系でのみ利用可能）を使用
      const memoryInfo = (performance as any).memory
      if (memoryInfo) {
        debugState.paplicoEngine.performance.memoryUsage.used =
          memoryInfo.usedJSHeapSize
        debugState.paplicoEngine.performance.memoryUsage.total =
          memoryInfo.totalJSHeapSize
        debugState.paplicoEngine.performance.memoryUsage.limit =
          memoryInfo.jsHeapSizeLimit
      } else {
        // performance.memory が利用できない場合は概算値を設定
        const estimatedUsage = this.estimateMemoryUsage()
        debugState.paplicoEngine.performance.memoryUsage.used =
          estimatedUsage.used
        debugState.paplicoEngine.performance.memoryUsage.total =
          estimatedUsage.total
        debugState.paplicoEngine.performance.memoryUsage.limit =
          estimatedUsage.limit
      }
    } catch (_error) {
      // メモリ情報の取得に失敗した場合は、概算値を設定
      const estimatedUsage = this.estimateMemoryUsage()
      debugState.paplicoEngine.performance.memoryUsage.used =
        estimatedUsage.used
      debugState.paplicoEngine.performance.memoryUsage.total =
        estimatedUsage.total
      debugState.paplicoEngine.performance.memoryUsage.limit =
        estimatedUsage.limit
    }
  }

  /**
   * メモリ使用量を概算
   */
  private estimateMemoryUsage(): {
    used: number
    total: number
    limit: number
  } {
    // 基本的な概算値を返す
    const activeDocument = this.documentManager.activeDocument
    let estimatedUsed = 1024 * 1024 // 基本的なアプリケーションサイズとして1MB

    if (activeDocument) {
      // アートオブジェクト数に基づく概算
      const artObjectCount = Object.keys(activeDocument.artObjects).length
      const layerCount = Object.keys(activeDocument.layers).length

      // 各アートオブジェクトを約10KB、各レイヤーを約1KBとして概算
      estimatedUsed += artObjectCount * 10 * 1024 + layerCount * 1024

      // フレームバッファやテクスチャの概算（canvas解像度ベース）
      const canvasMemory =
        this.state.viewport.width * this.state.viewport.height * 4 * 2 // 2つのバッファ
      estimatedUsed += canvasMemory
    }

    return {
      used: estimatedUsed,
      total: estimatedUsed * 1.5, // 概算として使用量の1.5倍を総量とする
      limit: 1024 * 1024 * 1024 * 2, // 2GBを上限として設定
    }
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
    this.documentManager.dispose()
  }
}

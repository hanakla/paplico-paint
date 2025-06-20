import { WebGPUEngine } from './webgpu/core-engine'
import { InputManager, EnhancedPointerEvent } from './input/input-manager'
import { Vector2, createVectorPath, getStrokeParams } from './state'
import {
  selectionState,
  selectionTool,
  selectObject,
  selectVertex,
  clearSelection,
  toggleObjectSelection,
  hitTestAtPosition,
  startDrag,
  updateDrag,
  endDrag,
  setSelectionMode,
  startDragSelection,
  updateDragSelection,
  endDragSelection,
  clearDragSelection,
  setExternalMoveObjectsFunction,
} from './selection-state'
import { Camera2D } from './camera/camera-2d'
import { proxy } from 'valtio'
import { DocumentManager, DocumentManagerChangeEvent } from './document-manager'
import { AddArtObjectCommand, MoveArtObjectsCommand } from './commands'
import { DeleteArtObjectsCommand } from './commands/DeleteArtObjectsCommand'
import { debugState } from './webgpu/core-engine'
import { CreateDocumentParams } from './document/document'
import { ICommand } from './history/command'
import { UUID } from './document/types'
import { createStrokeAppearance } from './document/appearance'
import { IExporterStrategy } from './exporters/IExporterStrategy'
import {
  DocumentSerializer,
  FileIOHelper,
  SerializationOptions,
  ProjectFileMetadata,
} from './document/serialization'
import { deepClone } from 'valtio/utils'
import { createPathArtObject, PathArtObject } from './document'
import { generateRandomNumber, generateUid } from './document/utils'

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.webgpuEngine = new WebGPUEngine(canvas)
    this.inputManager = new InputManager(canvas)
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
    const success = await this.webgpuEngine.initialize()
    if (success) {
      this.startRenderLoop()
      this.syncCameraWithState()
      // 初期化完了後にドキュメントを同期
      this.syncDocumentToWebGPUState()
    }
    return success
  }

  /**
   * 入力ハンドラーを設定
   */
  private setupInputHandlers(): void {
    // マウス/タッチ開始
    this.inputManager.on('pointerDown', (event) => {
      this.internalState.input.isMouseDown = true
      this.internalState.input.lastPointerPosition = {
        x: event.x,
        y: event.y,
      }

      // 右クリックまたはミドルクリックでパンモード
      if (
        event.originalEvent.button === 1 ||
        event.originalEvent.button === 2
      ) {
        this.internalState.input.isPanning = true
        this.canvas.style.cursor = 'grab'
        return
      }

      // ツール別の処理

      switch (this.webgpuEngine.state.tools.activeTool) {
        case 'brush':
          if (event.originalEvent.button === 0) {
            // 既存のストロークが残っている場合は強制終了
            if (this.webgpuEngine.state.tools.isDrawing) {
              this.webgpuEngine.endDrawing(this.documentManager.activeDocument)
            }
            this.handleDrawingStart(event)
          } else {
          }
          break
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
        case 'pan':
          this.internalState.input.isPanning = true
          this.canvas.style.cursor = 'grab'
          break
        default:
          break
      }
    })

    // マウス/タッチ移動
    this.inputManager.on('pointerMove', (event) => {
      const currentPos = { x: event.x, y: event.y }

      if (
        this.internalState.input.isPanning &&
        this.internalState.input.lastPointerPosition
      ) {
        // パン操作
        const deltaX =
          currentPos.x - this.internalState.input.lastPointerPosition.x
        const deltaY =
          currentPos.y - this.internalState.input.lastPointerPosition.y

        this.pan(deltaX, deltaY)
      } else {
        // ツール別の移動処理
        switch (this.webgpuEngine.state.tools.activeTool) {
          case 'brush':
            if (this.webgpuEngine.state.tools.isDrawing) {
              this.handleDrawingMove(event)
            }
            break
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
      }

      this.internalState.input.lastPointerPosition = currentPos
    })

    // マウス/タッチ終了
    this.inputManager.on('pointerUp', (event) => {
      // ツール別の終了処理
      switch (this.webgpuEngine.state.tools.activeTool) {
        case 'brush':
          if (this.webgpuEngine.state.tools.isDrawing) {
            this.handleDrawingEnd(event)
          }
          break
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
      } else if (isMacOSPinch) {
        // macOSピンチズーム (wheelイベントでctrlKey=trueの場合)
        const zoomFactor = 1 + event.deltaY * -0.01 // deltaYの符号を反転して感度調整
        const rect = this.canvas.getBoundingClientRect()
        const pinchCenter = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }

        this.zoomAtPoint(zoomFactor, pinchCenter)
      } else {
        // 通常のスクロールでパン
        // 小さなデルタ値を無視（Macトラックパッドの誤差対策）
        const threshold = 0.5
        const deltaX = Math.abs(event.deltaX) > threshold ? -event.deltaX : 0
        const deltaY = Math.abs(event.deltaY) > threshold ? event.deltaY : 0

        if (deltaX !== 0 || deltaY !== 0) {
          this.pan(deltaX, deltaY)
        }
      }
    })

    // タッチイベント（ピンチズーム）
    this.canvas.addEventListener('touchstart', (event) => {
      this.internalState.input.pointerCount = event.touches.length

      if (event.touches.length === 2) {
        this.internalState.input.isZooming = true
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
        case 'Delete':
        case 'Backspace':
          this.handleDeleteKey()
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

    const cameraBefore = { x: this.state.camera.x, y: this.state.camera.y }

    this.state.camera.x += offsetX
    this.state.camera.y += offsetY

    // 検証: 調整後に元の世界座標が正しい画面座標に戻るかチェック
    const verifyWorld = this.screenToWorld(currentCenter)

    this.syncCameraWithState()
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

      this.webgpuEngine.render(activeDocumentContext)
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
   * 特定の領域をレンダリング（従来方式 - 非推奨）
   * @deprecated renderRegionToTexture()の使用を推奨
   * @param region レンダリング領域（ワールド座標）
   * @param targetTexture 出力先テクスチャ（未指定の場合はキャンバス）
   * @returns レンダリング結果
   */
  async renderRegion(
    region: { x: number; y: number; width: number; height: number },
    targetTexture?: GPUTexture,
  ): Promise<void> {
    // ワールド座標をスクリーン座標に変換
    const topLeft = this.worldToScreen({ x: region.x, y: region.y })
    const bottomRight = this.worldToScreen({
      x: region.x + region.width,
      y: region.y + region.height,
    })

    const screenRegion = {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    }

    const activeDocumentContext = this.getActiveDocumentContext()
    if (!activeDocumentContext) {
      console.warn('No active document available for region rendering')
      return
    }

    return this.webgpuEngine.renderRegion(
      activeDocumentContext,
      screenRegion,
      targetTexture,
    )
  }

  /**
   * 効率的な部分レンダリング（オフスクリーンテクスチャ使用）
   * @param region ワールド座標での領域
   * @param outputWidth 出力テクスチャの幅（デフォルト：region.width）
   * @param outputHeight 出力テクスチャの高さ（デフォルト：region.height）
   * @returns レンダリング結果テクスチャ
   */
  async renderRegionToTexture(
    region: { x: number; y: number; width: number; height: number },
    outputWidth?: number,
    outputHeight?: number,
  ): Promise<GPUTexture | null> {
    return this.webgpuEngine.renderRegionToTexture(
      region,
      outputWidth,
      outputHeight,
    )
  }

  /**
   * 領域レンダリング結果をImageDataとして取得
   * @param region ワールド座標での領域
   * @param outputWidth 出力幅（デフォルト：region.width）
   * @param outputHeight 出力高さ（デフォルト：region.height）
   * @returns ImageDataまたはnull
   */
  async renderRegionToImageData(
    region: { x: number; y: number; width: number; height: number },
    outputWidth?: number,
    outputHeight?: number,
  ): Promise<ImageData | null> {
    const texture = await this.renderRegionToTexture(
      region,
      outputWidth,
      outputHeight,
    )
    if (!texture) {
      return null
    }

    try {
      const imageData = await this.webgpuEngine.readTextureAsImageData(texture)
      return imageData
    } finally {
      // テクスチャリソースをクリーンアップ
      texture.destroy()
    }
  }

  /**
   * 指定されたスクリーン領域をレンダリング（高度な制御用）
   * @param screenRegion スクリーン座標での領域
   * @param targetTexture 出力先テクスチャ（未指定の場合はキャンバス）
   * @returns レンダリング結果
   */
  async renderScreenRegion(
    screenRegion: { x: number; y: number; width: number; height: number },
    targetTexture?: GPUTexture,
  ): Promise<void> {
    const activeDocumentContext = this.getActiveDocumentContext()
    if (!activeDocumentContext) {
      console.warn('No active document available for screen region rendering')
      return
    }

    return this.webgpuEngine.renderRegion(
      activeDocumentContext,
      screenRegion,
      targetTexture,
    )
  }

  /**
   * 指定されたアートオブジェクトの境界領域をレンダリング
   * @param artObjectId アートオブジェクトID
   * @param padding 境界からの余白（ワールド座標）
   * @param targetTexture 出力先テクスチャ（未指定の場合はキャンバス）
   * @returns レンダリング結果
   */
  async renderArtObjectRegion(
    artObjectId: string,
    padding: number = 10,
    targetTexture?: GPUTexture,
  ): Promise<void> {
    const activeDocument = this.getActiveDocument()
    if (!activeDocument) {
      console.warn(
        'No active document available for art object region rendering',
      )
      return
    }

    const artObject = activeDocument.artObjects[artObjectId]
    if (!artObject) {
      console.warn(`Art object ${artObjectId} not found`)
      return
    }

    // アートオブジェクトの境界を計算
    let bounds: { x: number; y: number; width: number; height: number } | null =
      null

    if (artObject.type === 'path' && artObject.path?.points) {
      const pathBounds = this.calculatePathBounds(artObject.path.points)
      if (pathBounds) {
        bounds = {
          x: pathBounds.minX - padding,
          y: pathBounds.minY - padding,
          width: pathBounds.maxX - pathBounds.minX + 2 * padding,
          height: pathBounds.maxY - pathBounds.minY + 2 * padding,
        }
      }
    } else if (artObject.type === 'canvas') {
      const transform = artObject.transform
      bounds = {
        x: transform.x - padding,
        y: transform.y - padding,
        width: artObject.width * (transform.scaleX || 1) + 2 * padding,
        height: artObject.height * (transform.scaleY || 1) + 2 * padding,
      }
    }

    if (!bounds) {
      console.warn(`Could not calculate bounds for art object ${artObjectId}`)
      return
    }

    return this.renderRegion(bounds, targetTexture)
  }

  /**
   * 選択されたオブジェクトの領域をレンダリング
   * @param padding 境界からの余白（ワールド座標）
   * @param targetTexture 出力先テクスチャ（未指定の場合はキャンバス）
   * @returns レンダリング結果
   */
  async renderSelectedObjectsRegion(
    padding: number = 10,
    targetTexture?: GPUTexture,
  ): Promise<void> {
    const { selectionState } = await import('./selection-state')
    const selectedIds = Array.from(selectionState.selectedObjects)

    if (selectedIds.length === 0) {
      console.warn('No objects selected for region rendering')
      return
    }

    const activeDocument = this.getActiveDocument()
    if (!activeDocument) {
      console.warn(
        'No active document available for selected objects region rendering',
      )
      return
    }

    // 選択された全オブジェクトの統合境界を計算
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    for (const objectId of selectedIds) {
      const artObject = activeDocument.artObjects[objectId]
      if (!artObject) continue

      let objectBounds: {
        minX: number
        minY: number
        maxX: number
        maxY: number
      } | null = null

      if (artObject.type === 'path' && artObject.path?.points) {
        objectBounds = this.calculatePathBounds(artObject.path.points)
      } else if (artObject.type === 'canvas') {
        const transform = artObject.transform
        objectBounds = {
          minX: transform.x,
          minY: transform.y,
          maxX: transform.x + artObject.width * (transform.scaleX || 1),
          maxY: transform.y + artObject.height * (transform.scaleY || 1),
        }
      }

      if (objectBounds) {
        minX = Math.min(minX, objectBounds.minX)
        minY = Math.min(minY, objectBounds.minY)
        maxX = Math.max(maxX, objectBounds.maxX)
        maxY = Math.max(maxY, objectBounds.maxY)
      }
    }

    if (
      !isFinite(minX) ||
      !isFinite(minY) ||
      !isFinite(maxX) ||
      !isFinite(maxY)
    ) {
      console.warn('Could not calculate bounds for selected objects')
      return
    }

    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding,
    }

    return this.renderRegion(bounds, targetTexture)
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
  setActiveTool(tool: any): void {
    this.webgpuEngine.setActiveTool(tool)
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
   * 描画開始
   */
  startDrawing(path: any): void {
    this.webgpuEngine.startDrawing(path)
  }

  /**
   * 描画終了
   */
  endDrawing(document: any): void {
    this.webgpuEngine.endDrawing(document)
  }

  /**
   * 現在のストロークにポイントを追加
   */
  addPointToCurrentStroke(point: any): void {
    this.webgpuEngine.addPointToCurrentStroke(point)
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
    return this.documentManager.undo()
  }

  /**
   * Redo操作
   */
  redo(): boolean {
    return this.documentManager.redo()
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
  loadDocument(data: Uint8Array, options?: SerializationOptions): UUID | null {
    const document = DocumentSerializer.deserialize(data)
    if (!document) return null

    const documentId = this.documentManager.loadDocument(document.document)

    return documentId
  }

  /**
   * 描画開始処理
   */
  private handleDrawingStart(event: EnhancedPointerEvent): void {
    // ドキュメント状態とレイヤー状態を確認
    const activeDocument = this.documentManager.activeDocument

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
  }

  /**
   * 描画移動処理
   */
  private handleDrawingMove(event: EnhancedPointerEvent): void {
    if (!this.webgpuEngine.state.tools.currentStroke) return

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

    // リアルタイムプレビューのためにレンダリングを要求
    // レンダーループが自動的にrenderWithStrokeModeを呼び出す
  }

  /**
   * 描画終了処理
   */
  private handleDrawingEnd(event: EnhancedPointerEvent): void {
    if (!this.webgpuEngine.state.tools.currentStroke) return

    // 描画終了（パスをレイヤーに追加）
    const document = this.documentManager.getDocument(
      this.state.activeDocumentId,
    )

    if (!document) return

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
      const currentStroke = this.webgpuEngine.state.tools.currentStroke

      if (currentStroke && currentStroke.points.length > 0) {
        const { strokeSettings: brushConfig } = this.webgpuEngine.state
        // ドキュメントに追加するコマンドを実行
        const artObject = createPathArtObject({
          layerId: vectorLayer.id,
          path: currentStroke,
          appearances: [
            createStrokeAppearance(getStrokeParams(this.webgpuEngine.state)),
          ],
        })

        const addCommand = new AddArtObjectCommand({
          artObjectData: artObject,
          timestamp: new Date(),
        })

        // ドキュメントとレイヤー状態を確認
        const beforeExecute = {
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

        // 実行後の状態を確認
        const afterExecute = {
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

    // WebGPUエンジンの描画終了処理
    this.webgpuEngine.endDrawing(document)
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

      if (this.webgpuEngine.state.tools.activeTool === 'vertexSelect') {
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
        this.webgpuEngine.state.tools.activeTool === 'move' ||
        (this.webgpuEngine.state.tools.activeTool === 'select' &&
          selectionState.selectedObjects.has(hitId))
      ) {
        startDrag(worldPos)
      }
    } else {
      // オブジェクトがヒットしなかった場合
      if (this.webgpuEngine.state.tools.activeTool === 'select') {
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
    } else if (selectionState.isDragSelecting) {
      updateDragSelection(worldPos)
    }
  }

  /**
   * 選択ツールの終了処理
   */
  private handleSelectionEnd(event: EnhancedPointerEvent): void {
    const isMultiSelect = (event.originalEvent as PointerEvent).shiftKey

    if (selectionState.isDragging) {
      endDrag()
    } else if (selectionState.isDragSelecting) {
      // カスタムドラッグ選択終了処理
      this.endDragSelectionWithRaycast(isMultiSelect)
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
      const closestHit = hits[0]

      // カーソルを変更
      this.canvas.style.cursor = 'pointer'
    } else {
      // カーソルをデフォルトに戻す
      this.canvas.style.cursor =
        this.webgpuEngine.state.tools.activeTool === 'select'
          ? 'crosshair'
          : 'move'
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
    } else {
      // ホバー時のカーソル変更など
      this.canvas.style.cursor = 'default'
    }
  }

  /**
   * 頂点編集ツールの終了処理
   */
  private handleVertexEditEnd(event: EnhancedPointerEvent): void {
    const uiComponentManager = this.webgpuEngine.getUIComponentManager()
    const vertexEditTool = uiComponentManager?.getVertexEditTool()
    if (!uiComponentManager || !vertexEditTool) {
      return
    }

    // マウスアップ処理を実行
    vertexEditTool.onMouseUp()

    // カーソルをデフォルトに戻す
    this.canvas.style.cursor = 'default'
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
      return
    }

    const document = documentContext.document

    // ドキュメント内のArtObjectを詳細にログ出力

    // カメラ状態の詳細デバッグ
    const paplicoCamera = this.camera
    const webgpuCamera = this.webgpuEngine.getCamera()
    const engineState = this.webgpuEngine.state.viewport
    const paplicoState = this.state.camera

    // ワールド座標に変換（複数の方法で確認）
    const worldPos1 = this.webgpuEngine.canvasToWorld(event.x, event.y)
    const worldPos2 = this.screenToWorld({ x: event.x, y: event.y })

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

    if (legacyHits.length > 0 || raycastHits.length > 0) {
    } else {
    }
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

  /**
   * エクスポート機能
   *
   * @param strategy - エクスポート戦略
   * @returns エクスポートされたファイルの配列
   */
  async export(strategy: IExporterStrategy, documentId: UUID): Promise<File[]> {
    const activeDocumentContext =
      this.documentManager.getDocumentContext(documentId)
    if (!activeDocumentContext) {
      throw new Error('No active document available for export')
    }

    try {
      const files = await strategy.export(
        activeDocumentContext,
        this.webgpuEngine,
      )

      return files
    } catch (error) {
      throw error
    }
  }

  /**
   * WebGPUEngineへのアクセス
   */
  getEngine(): WebGPUEngine {
    return this.webgpuEngine
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

import { WebGPUEngine } from './webgpu/core-engine'
import { InputManager, EnhancedPointerEvent } from './input/input-manager'
import {
  engineState,
  Vector2,
  startDrawing,
  endDrawing,
  addPointToCurrentStroke,
  createVectorPath,
} from './state'
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
} from './selection-state'
import { Camera2D } from './camera/camera-2d'
import { proxy } from 'valtio'
import { debugLogger } from '../utils/debug-logger'
import { DocumentManager, DocumentManagerChangeEvent } from './document-manager'
import { CreateDocumentParams } from './document/document'
import { ICommand } from './history/command'
import { UUID } from './document/types'
import {
  DocumentSerializer,
  FileIOHelper,
  SerializationOptions,
  ProjectFileMetadata,
} from './document/serialization'

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
  activeDocumentId: UUID | null
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
  protected state: PaplicoState
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
      activeDocumentId: null,
    })

    this.setupInputHandlers()
    this.setupDocumentManagerHandlers()
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
    this.inputManager.on('pointerDown', (event) => {
      debugLogger.debug('🖱️ pointerDown event received', {
        activeTool: engineState.tools.activeTool,
        button: event.originalEvent.button,
        x: event.x,
        y: event.y,
        pressure: event.pressure,
        tiltX: event.tiltX,
        tiltY: event.tiltY,
        velocity: event.velocity,
        pointerType: event.pointerType,
      })

      this.state.input.isMouseDown = true
      this.state.input.lastPointerPosition = {
        x: event.x,
        y: event.y,
      }

      // 右クリックまたはミドルクリックでパンモード
      if (
        event.originalEvent.button === 1 ||
        event.originalEvent.button === 2
      ) {
        this.state.input.isPanning = true
        this.canvas.style.cursor = 'grab'
        return
      }

      // ツール別の処理
      switch (engineState.tools.activeTool) {
        case 'brush':
          if (event.originalEvent.button === 0) {
            this.handleDrawingStart(event)
          }
          break
        case 'select':
        case 'move':
        case 'vertexSelect':
          this.handleSelectionStart(event)
          break
        case 'pan':
          this.state.input.isPanning = true
          this.canvas.style.cursor = 'grab'
          break
      }
    })

    // マウス/タッチ移動
    this.inputManager.on('pointerMove', (event) => {
      const currentPos = { x: event.x, y: event.y }

      if (this.state.input.isPanning && this.state.input.lastPointerPosition) {
        // パン操作
        const deltaX = currentPos.x - this.state.input.lastPointerPosition.x
        const deltaY = currentPos.y - this.state.input.lastPointerPosition.y

        this.pan(deltaX, deltaY)
      } else {
        // ツール別の移動処理
        switch (engineState.tools.activeTool) {
          case 'brush':
            if (engineState.tools.isDrawing) {
              this.handleDrawingMove(event)
            }
            break
          case 'move':
            if (selectionState.isDragging) {
              this.handleSelectionMove(event)
            }
            break
        }
      }

      this.state.input.lastPointerPosition = currentPos
    })

    // マウス/タッチ終了
    this.inputManager.on('pointerUp', (event) => {
      // ツール別の終了処理
      switch (engineState.tools.activeTool) {
        case 'brush':
          if (engineState.tools.isDrawing) {
            this.handleDrawingEnd(event)
          }
          break
        case 'move':
          if (selectionState.isDragging) {
            this.handleSelectionEnd(event)
          }
          break
      }

      this.state.input.isMouseDown = false
      this.state.input.isPanning = false
      this.state.input.lastPointerPosition = null
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
    engineState.viewport.x = this.state.camera.x
    engineState.viewport.y = this.state.camera.y
    engineState.viewport.zoom = this.state.camera.zoom
    engineState.viewport.rotation = this.state.camera.rotation
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
   * 統合ステートを取得
   */
  getState(): PaplicoState {
    return this.state
  }

  /**
   * ドキュメントマネージャーのイベントハンドラーを設定
   */
  private setupDocumentManagerHandlers(): void {
    this.documentManager.addChangeListener(
      (event: DocumentManagerChangeEvent) => {
        if (event.type === 'active-document-changed') {
          // アクティブドキュメントが変更された時にPaplicoStateを更新
          this.state.activeDocumentId = event.documentId

          // アライメントガイドを更新
          this.updateAlignmentGuides()
        }
      },
    )
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
    return this.documentManager.getHistoryState(documentId)
  }

  /**
   * アクティブドキュメントのヒストリー変更リスナーを追加
   */
  addHistoryChangeListener(listener: (event: any) => void): void {
    const context = this.documentManager.getActiveDocumentContext()
    if (context) {
      context.history.addChangeListener(listener)
    }
  }

  /**
   * アクティブドキュメントのヒストリー変更リスナーを削除
   */
  removeHistoryChangeListener(listener: (event: any) => void): void {
    const context = this.documentManager.getActiveDocumentContext()
    if (context) {
      context.history.removeChangeListener(listener)
    }
  }

  /**
   * ドキュメントを保存済みとしてマーク
   */
  markDocumentAsSaved(documentId?: UUID): void {
    const targetId = documentId || this.documentManager.getActiveDocument()?.id
    if (targetId) {
      this.documentManager.markDocumentAsSaved(targetId)
    }
  }

  /**
   * ドキュメントマネージャーを取得（高度な操作用）
   */
  getDocumentManager(): DocumentManager {
    return this.documentManager
  }

  // === ファイル保存・読み込みAPI ===

  /**
   * アクティブドキュメントをファイルとして保存
   */
  saveDocumentToFile(
    filename?: string,
    options: SerializationOptions = {},
  ): void {
    const document = this.getActiveDocument()
    if (!document) {
      throw new Error('No active document to save')
    }

    FileIOHelper.saveDocumentAsFile(document, filename, options)

    // 保存後に変更フラグをクリア
    this.markDocumentAsSaved()
  }

  /**
   * ドキュメントを指定してファイルとして保存
   */
  saveSpecificDocumentToFile(
    documentId: UUID,
    filename?: string,
    options: SerializationOptions = {},
  ): void {
    const document = this.documentManager.getDocument(documentId)
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`)
    }

    FileIOHelper.saveDocumentAsFile(document, filename, options)

    // 保存後に変更フラグをクリア
    this.markDocumentAsSaved(documentId)
  }

  /**
   * ファイル選択ダイアログを開いてドキュメントを読み込み
   */
  async openDocumentFromFile(): Promise<UUID> {
    try {
      const { document, metadata } = await FileIOHelper.openFileDialog()

      // 新しいドキュメントとして追加
      const documentId = this.documentManager.createDocument({
        name: document.name,
      })

      // 読み込んだドキュメントデータで置き換え
      const context = this.documentManager.getDocumentContext(documentId)
      if (context) {
        context.document = document
        context.isDirty = false
        context.lastSaved = metadata.updatedAt
      }

      // アクティブドキュメントに設定
      this.setActiveDocument(documentId)

      return documentId
    } catch (error) {
      throw error
    }
  }

  /**
   * ファイルからドキュメントを読み込み（File オブジェクト指定）
   */
  async loadDocumentFromFile(file: File): Promise<UUID> {
    try {
      const { document, metadata } =
        await FileIOHelper.loadDocumentFromFile(file)

      // 新しいドキュメントとして追加
      const documentId = this.documentManager.createDocument({
        name: document.name,
      })

      // 読み込んだドキュメントデータで置き換え
      const context = this.documentManager.getDocumentContext(documentId)
      if (context) {
        context.document = document
        context.isDirty = false
        context.lastSaved = metadata.updatedAt
      }

      // アクティブドキュメントに設定
      this.setActiveDocument(documentId)

      return documentId
    } catch (error) {
      throw error
    }
  }

  /**
   * アクティブドキュメントをCBORバイナリに変換
   */
  serializeActiveDocument(options: SerializationOptions = {}): Uint8Array {
    const document = this.getActiveDocument()
    if (!document) {
      throw new Error('No active document to serialize')
    }

    return DocumentSerializer.serialize(document, options)
  }

  /**
   * CBORバイナリからドキュメントを復元して読み込み
   */
  deserializeDocument(data: Uint8Array): UUID {
    try {
      const { document, metadata } = DocumentSerializer.deserialize(data)

      // 新しいドキュメントとして追加
      const documentId = this.documentManager.createDocument({
        name: document.name,
      })

      // 復元したドキュメントデータで置き換え
      const context = this.documentManager.getDocumentContext(documentId)
      if (context) {
        context.document = document
        context.isDirty = false
        context.lastSaved = metadata.updatedAt
      }

      // アクティブドキュメントに設定
      this.setActiveDocument(documentId)

      return documentId
    } catch (error) {
      throw error
    }
  }

  /**
   * ドキュメントのファイルサイズを見積もり
   */
  estimateDocumentFileSize(documentId?: UUID): number {
    const document = documentId
      ? this.documentManager.getDocument(documentId)
      : this.getActiveDocument()

    if (!document) {
      return 0
    }

    return DocumentSerializer.estimateFileSize(document)
  }

  /**
   * 描画開始処理
   */
  private handleDrawingStart(event: EnhancedPointerEvent): void {
    debugLogger.debug('🎨 handleDrawingStart called', {
      activeTool: engineState.tools.activeTool,
      button: event.originalEvent.button,
      x: event.x,
      y: event.y,
      pressure: event.pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      velocity: event.velocity,
      pointerType: event.pointerType,
    })

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
    startDrawing(vectorPath)
  }

  /**
   * 描画移動処理
   */
  private handleDrawingMove(event: EnhancedPointerEvent): void {
    if (!engineState.tools.currentStroke) return

    debugLogger.debug('🎨 handleDrawingMove called', {
      hasCurrentStroke: !!engineState.tools.currentStroke,
      currentStrokePoints: engineState.tools.currentStroke?.points?.length || 0,
      x: event.x,
      y: event.y,
      pressure: event.pressure,
      tiltX: event.tiltX,
      tiltY: event.tiltY,
      velocity: event.velocity,
    })

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
    addPointToCurrentStroke(enhancedPoint)

    // リアルタイムプレビューのためにレンダリングを要求
    // レンダーループが自動的にrenderWithStrokeModeを呼び出す
  }

  /**
   * 描画終了処理
   */
  private handleDrawingEnd(event: EnhancedPointerEvent): void {
    if (!engineState.tools.currentStroke) return

    debugLogger.debug('🎨 handleDrawingEnd called', {
      hasCurrentStroke: !!engineState.tools.currentStroke,
      currentStrokePoints: engineState.tools.currentStroke?.points?.length || 0,
      x: event.x,
      y: event.y,
      pressure: event.pressure,
      pointerType: event.pointerType,
    })

    // 描画終了（パスをレイヤーに追加）
    const activeDocumentContext = this.documentManager.getDocumentContext(
      this.state.activeDocumentId,
    )
    if (activeDocumentContext) {
      endDrawing(activeDocumentContext.document)
    }
  }

  /**
   * 選択ツールの開始処理
   */
  private handleSelectionStart(event: EnhancedPointerEvent): void {
    const worldPos = this.screenToWorld({ x: event.x, y: event.y })
    const isMultiSelect = (event.originalEvent as PointerEvent).shiftKey

    debugLogger.debug('🎯 Selection start', {
      tool: engineState.tools.activeTool,
      worldPos,
      isMultiSelect,
    })

    // ヒットテスト
    const hitId = hitTestAtPosition(
      worldPos,
      engineState.tools.activeTool === 'vertexSelect' ? 'vertex' : 'object',
    )

    if (hitId) {
      if (engineState.tools.activeTool === 'vertexSelect') {
        selectVertex(hitId, isMultiSelect)
      } else {
        if (isMultiSelect) {
          toggleObjectSelection(hitId)
        } else {
          selectObject(hitId, false)
        }
      }

      // 移動ツールの場合はドラッグ開始
      if (engineState.tools.activeTool === 'move') {
        startDrag(worldPos)
      }
    } else if (!isMultiSelect) {
      clearSelection()
    }
  }

  /**
   * 選択ツールの移動処理
   */
  private handleSelectionMove(event: EnhancedPointerEvent): void {
    const worldPos = this.screenToWorld({ x: event.x, y: event.y })

    if (selectionState.isDragging) {
      updateDrag(worldPos)

      debugLogger.debug('🎯 Selection move', {
        worldPos,
        dragOffset: selectionState.dragOffset,
        selectedCount: selectionState.selectedObjects.size,
      })
    }
  }

  /**
   * 選択ツールの終了処理
   */
  private handleSelectionEnd(event: EnhancedPointerEvent): void {
    if (selectionState.isDragging) {
      endDrag()

      debugLogger.debug('🎯 Selection end', {
        finalPosition: this.screenToWorld({ x: event.x, y: event.y }),
        selectedCount: selectionState.selectedObjects.size,
      })
    }
  }

  /**
   * スクリーン座標をワールド座標に変換
   */
  private screenToWorld(screenPos: Vector2): Vector2 {
    // カメラの変換を適用
    const worldX =
      (screenPos.x - this.state.viewport.width / 2) / this.state.camera.zoom +
      this.state.camera.x
    const worldY =
      (screenPos.y - this.state.viewport.height / 2) / this.state.camera.zoom +
      this.state.camera.y

    return { x: worldX, y: worldY }
  }

  /**
   * ワールド座標をスクリーン座標に変換
   */
  private worldToScreen(worldPos: Vector2): Vector2 {
    const screenX =
      (worldPos.x - this.state.camera.x) * this.state.camera.zoom +
      this.state.viewport.width / 2
    const screenY =
      (worldPos.y - this.state.camera.y) * this.state.camera.zoom +
      this.state.viewport.height / 2

    return { x: screenX, y: screenY }
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

/**
 * 入力管理クラス
 * マウス、タッチ、キーボード入力を統合管理
 */
export class InputManager {
  private canvas: HTMLCanvasElement
  private pointerDownHandlers: Array<(event: PointerEvent) => void> = []
  private pointerMoveHandlers: Array<(event: PointerEvent) => void> = []
  private pointerUpHandlers: Array<(event: PointerEvent) => void> = []
  private wheelHandlers: Array<(event: WheelEvent) => void> = []
  private keyDownHandlers: Array<(event: KeyboardEvent) => void> = []
  private keyUpHandlers: Array<(event: KeyboardEvent) => void> = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.setupEventListeners()
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    // ポインターイベント
    this.canvas.addEventListener(
      'pointerdown',
      this.handlePointerDown.bind(this),
    )
    this.canvas.addEventListener(
      'pointermove',
      this.handlePointerMove.bind(this),
    )
    this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this))
    this.canvas.addEventListener(
      'pointercancel',
      this.handlePointerUp.bind(this),
    )

    // ホイールイベント
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this))

    // キーボードイベント
    window.addEventListener('keydown', this.handleKeyDown.bind(this))
    window.addEventListener('keyup', this.handleKeyUp.bind(this))

    // コンテキストメニューを無効化（右クリック用）
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  /**
   * ポインターダウンイベントハンドラ
   */
  private handlePointerDown(event: PointerEvent): void {
    this.canvas.setPointerCapture(event.pointerId)
    this.pointerDownHandlers.forEach((handler) => handler(event))
  }

  /**
   * ポインタームーブイベントハンドラ
   */
  private handlePointerMove(event: PointerEvent): void {
    this.pointerMoveHandlers.forEach((handler) => handler(event))
  }

  /**
   * ポインターアップイベントハンドラ
   */
  private handlePointerUp(event: PointerEvent): void {
    this.canvas.releasePointerCapture(event.pointerId)
    this.pointerUpHandlers.forEach((handler) => handler(event))
  }

  /**
   * ホイールイベントハンドラ
   */
  private handleWheel(event: WheelEvent): void {
    this.wheelHandlers.forEach((handler) => handler(event))
  }

  /**
   * キーダウンイベントハンドラ
   */
  private handleKeyDown(event: KeyboardEvent): void {
    this.keyDownHandlers.forEach((handler) => handler(event))
  }

  /**
   * キーアップイベントハンドラ
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.keyUpHandlers.forEach((handler) => handler(event))
  }

  /**
   * ポインターダウンイベントリスナーを追加
   */
  onPointerDown(handler: (event: PointerEvent) => void): void {
    this.pointerDownHandlers.push(handler)
  }

  /**
   * ポインタームーブイベントリスナーを追加
   */
  onPointerMove(handler: (event: PointerEvent) => void): void {
    this.pointerMoveHandlers.push(handler)
  }

  /**
   * ポインターアップイベントリスナーを追加
   */
  onPointerUp(handler: (event: PointerEvent) => void): void {
    this.pointerUpHandlers.push(handler)
  }

  /**
   * ホイールイベントリスナーを追加
   */
  onWheel(handler: (event: WheelEvent) => void): void {
    this.wheelHandlers.push(handler)
  }

  /**
   * キーダウンイベントリスナーを追加
   */
  onKeyDown(handler: (event: KeyboardEvent) => void): void {
    this.keyDownHandlers.push(handler)
  }

  /**
   * キーアップイベントリスナーを追加
   */
  onKeyUp(handler: (event: KeyboardEvent) => void): void {
    this.keyUpHandlers.push(handler)
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.canvas.removeEventListener(
      'pointerdown',
      this.handlePointerDown.bind(this),
    )
    this.canvas.removeEventListener(
      'pointermove',
      this.handlePointerMove.bind(this),
    )
    this.canvas.removeEventListener(
      'pointerup',
      this.handlePointerUp.bind(this),
    )
    this.canvas.removeEventListener(
      'pointercancel',
      this.handlePointerUp.bind(this),
    )
    this.canvas.removeEventListener('wheel', this.handleWheel.bind(this))
    this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault())

    window.removeEventListener('keydown', this.handleKeyDown.bind(this))
    window.removeEventListener('keyup', this.handleKeyUp.bind(this))

    this.pointerDownHandlers = []
    this.pointerMoveHandlers = []
    this.pointerUpHandlers = []
    this.wheelHandlers = []
    this.keyDownHandlers = []
    this.keyUpHandlers = []
  }
}

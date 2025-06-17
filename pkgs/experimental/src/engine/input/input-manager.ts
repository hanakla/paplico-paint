import { Emitter } from '@paplico/shared-lib'

/**
 * 入力管理クラス
 * マウス、タッチ、キーボード入力を統合管理
 */
export class InputManager extends Emitter<{
  pointerDown: PointerEvent
  pointerMove: PointerEvent
  pointerUp: PointerEvent
  wheel: WheelEvent
  keyDown: KeyboardEvent
  keyUp: KeyboardEvent
}> {
  private abort: AbortController
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    super()

    this.abort = new AbortController()
    this.canvas = canvas
    this.setupEventListeners()
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    const { signal } = this.abort

    // ポインターイベント
    this.canvas.addEventListener(
      'pointerdown',
      this.handlePointerDown.bind(this),
      { signal },
    )
    this.canvas.addEventListener(
      'pointermove',
      this.handlePointerMove.bind(this),
      { signal },
    )
    this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this), {
      signal,
    })
    this.canvas.addEventListener(
      'pointercancel',
      this.handlePointerUp.bind(this),
      { signal },
    )

    // ホイールイベント
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), {
      signal,
    })

    // キーボードイベント
    window.addEventListener('keydown', this.handleKeyDown.bind(this), {
      signal,
    })
    window.addEventListener('keyup', this.handleKeyUp.bind(this), {
      signal,
    })

    // コンテキストメニューを無効化（右クリック用）
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), {
      signal,
    })
  }

  /**
   * ポインターダウンイベントハンドラ
   */
  private handlePointerDown(event: PointerEvent): void {
    this.canvas.setPointerCapture(event.pointerId)
    this.emit('pointerDown', event)
  }

  /**
   * ポインタームーブイベントハンドラ
   */
  private handlePointerMove(event: PointerEvent): void {
    this.emit('pointerMove', event)
  }

  /**
   * ポインターアップイベントハンドラ
   */
  private handlePointerUp(event: PointerEvent): void {
    this.canvas.releasePointerCapture(event.pointerId)
    this.emit('pointerUp', event)
  }

  /**
   * ホイールイベントハンドラ
   */
  private handleWheel(event: WheelEvent): void {
    this.emit('wheel', event)
  }

  /**
   * キーダウンイベントハンドラ
   */
  private handleKeyDown(event: KeyboardEvent): void {
    this.emit('keyDown', event)
  }

  /**
   * キーアップイベントハンドラ
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.emit('keyUp', event)
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.abort.abort()

    this.pointerDownHandlers = []
    this.pointerMoveHandlers = []
    this.pointerUpHandlers = []
    this.wheelHandlers = []
    this.keyDownHandlers = []
    this.keyUpHandlers = []
  }
}

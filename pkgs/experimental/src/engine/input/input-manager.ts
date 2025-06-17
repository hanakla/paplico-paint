import { Emitter } from '@paplico/shared-lib'

/**
 * 拡張されたポインターイベントデータ
 */
export interface EnhancedPointerEvent {
  originalEvent: PointerEvent
  /** 座標 */
  x: number
  y: number
  /** 筆圧 (0.0-1.0) */
  pressure: number
  /** ペンの傾きX (-1.0 - 1.0) */
  tiltX: number
  /** ペンの傾きY (-1.0 - 1.0) */
  tiltY: number
  /** 描画時の速度 (ピクセル/秒) */
  velocity: number
  /** この点が取得された時刻 (performance.now()) */
  timestamp: number
  /** ポインターの種類 */
  pointerType: string
}

/**
 * 入力管理クラス
 * マウス、タッチ、キーボード入力を統合管理
 * pressure、tilt、velocity の詳細データを提供
 */
export class InputManager extends Emitter<{
  pointerDown: EnhancedPointerEvent
  pointerMove: EnhancedPointerEvent
  pointerUp: EnhancedPointerEvent
  wheel: WheelEvent
  keyDown: KeyboardEvent
  keyUp: KeyboardEvent
}> {
  private abort: AbortController
  private canvas: HTMLCanvasElement
  private lastPointerEvent: EnhancedPointerEvent | null = null
  private lastMoveTime: number = 0

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
   * PointerEventからEnhancedPointerEventを生成
   */
  private createEnhancedPointerEvent(
    event: PointerEvent,
  ): EnhancedPointerEvent {
    const currentTime = performance.now()
    const rect = this.canvas.getBoundingClientRect()

    // キャンバス相対座標を計算
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // 速度計算
    let velocity = 0
    if (this.lastPointerEvent && this.lastMoveTime > 0) {
      const deltaTime = (currentTime - this.lastMoveTime) / 1000 // 秒単位
      const deltaX = x - this.lastPointerEvent.x
      const deltaY = y - this.lastPointerEvent.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      if (deltaTime > 0) {
        velocity = distance / deltaTime // ピクセル/秒
      }
    }

    const enhancedEvent: EnhancedPointerEvent = {
      originalEvent: event,
      x,
      y,
      pressure: this.extractPressure(event),
      tiltX: this.extractTiltX(event),
      tiltY: this.extractTiltY(event),
      velocity,
      timestamp: currentTime,
      pointerType: event.pointerType,
    }

    return enhancedEvent
  }

  /**
   * PointerEventから筆圧情報を抽出
   */
  private extractPressure(event: PointerEvent): number {
    // PointerEvent.pressureは0.0-1.0の範囲
    let pressure = event.pressure

    // マウスの場合はクリック状態を筆圧として扱う
    if (event.pointerType === 'mouse') {
      pressure = event.buttons > 0 ? 1.0 : 0.0
    }

    // タッチの場合はforce property（iOS Safari）を優先
    if (
      event.pointerType === 'touch' &&
      'force' in event &&
      typeof (event as any).force === 'number'
    ) {
      pressure = (event as any).force
    }

    return Math.max(0.0, Math.min(1.0, pressure))
  }

  /**
   * PointerEventからペンの傾きX情報を抽出
   */
  private extractTiltX(event: PointerEvent): number {
    // PointerEvent.tiltXは度単位 (-90 - 90)
    let tiltX = event.tiltX || 0

    // -1.0 から 1.0 の範囲に正規化
    return Math.max(-1.0, Math.min(1.0, tiltX / 90.0))
  }

  /**
   * PointerEventからペンの傾きY情報を抽出
   */
  private extractTiltY(event: PointerEvent): number {
    // PointerEvent.tiltYは度単位 (-90 - 90)
    let tiltY = event.tiltY || 0

    // -1.0 から 1.0 の範囲に正規化
    return Math.max(-1.0, Math.min(1.0, tiltY / 90.0))
  }

  /**
   * ポインターダウンイベントハンドラ
   */
  private handlePointerDown(event: PointerEvent): void {
    this.canvas.setPointerCapture(event.pointerId)

    const enhancedEvent = this.createEnhancedPointerEvent(event)
    this.lastPointerEvent = enhancedEvent
    this.lastMoveTime = enhancedEvent.timestamp

    this.emit('pointerDown', enhancedEvent)
  }

  /**
   * ポインタームーブイベントハンドラ
   */
  private handlePointerMove(event: PointerEvent): void {
    const enhancedEvent = this.createEnhancedPointerEvent(event)
    this.lastPointerEvent = enhancedEvent
    this.lastMoveTime = enhancedEvent.timestamp

    this.emit('pointerMove', enhancedEvent)
  }

  /**
   * ポインターアップイベントハンドラ
   */
  private handlePointerUp(event: PointerEvent): void {
    this.canvas.releasePointerCapture(event.pointerId)

    const enhancedEvent = this.createEnhancedPointerEvent(event)
    this.lastPointerEvent = null
    this.lastMoveTime = 0

    this.emit('pointerUp', enhancedEvent)
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
  }
}

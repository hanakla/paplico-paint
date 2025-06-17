import { Vector2 } from '@/engine/state'

export interface PointerEvent {
  pointerId: number
  x: number
  y: number
  pressure: number
  tiltX: number
  tiltY: number
  twist: number
  pointerType: 'mouse' | 'pen' | 'touch'
  timestamp: number
}

export class InputManager {
  private activePointers = new Map<number, PointerEvent>()
  private callbacks: {
    onPointerDown?: (event: PointerEvent) => void
    onPointerMove?: (event: PointerEvent) => void
    onPointerUp?: (event: PointerEvent) => void
  } = {}

  // バインドされたハンドラーを保持してremoveEventListenerで使用
  private boundHandlers = {
    pointerDown: this.handlePointerDown.bind(this),
    pointerMove: this.handlePointerMove.bind(this),
    pointerUp: this.handlePointerUp.bind(this),
    touchStart: this.preventDefaultTouch.bind(this),
    touchMove: this.preventDefaultTouch.bind(this),
    touchEnd: this.preventDefaultTouch.bind(this),
  }

  constructor(private canvas: HTMLCanvasElement) {
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Canvas上でのポインターダウン
    this.canvas.addEventListener('pointerdown', this.boundHandlers.pointerDown)

    // ポインタームーブはdocument全体で監視（キャプチャを使用）
    document.addEventListener('pointermove', this.boundHandlers.pointerMove)

    // ポインターアップもdocument全体で監視
    document.addEventListener('pointerup', this.boundHandlers.pointerUp)
    document.addEventListener('pointercancel', this.boundHandlers.pointerUp)

    // タッチデバイスでのスクロール防止
    this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart)
    this.canvas.addEventListener('touchmove', this.boundHandlers.touchMove)
    this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd)
  }

  private preventDefaultTouch(event: TouchEvent) {
    event.preventDefault()
  }

  private createPointerEvent(
    nativeEvent: globalThis.PointerEvent,
  ): PointerEvent {
    const rect = this.canvas.getBoundingClientRect()
    return {
      pointerId: nativeEvent.pointerId,
      x: nativeEvent.clientX - rect.left,
      y: nativeEvent.clientY - rect.top,
      pressure: nativeEvent.pressure,
      tiltX: nativeEvent.tiltX,
      tiltY: nativeEvent.tiltY,
      twist: nativeEvent.twist,
      pointerType: nativeEvent.pointerType as 'mouse' | 'pen' | 'touch',
      timestamp: Date.now(),
    }
  }

  private handlePointerDown(event: globalThis.PointerEvent) {
    event.preventDefault()
    this.canvas.setPointerCapture(event.pointerId)

    const pointerEvent = this.createPointerEvent(event)
    this.activePointers.set(event.pointerId, pointerEvent)

    this.callbacks.onPointerDown?.(pointerEvent)
  }

  private handlePointerMove(event: globalThis.PointerEvent) {
    if (!this.activePointers.has(event.pointerId)) return

    const pointerEvent = this.createPointerEvent(event)
    this.activePointers.set(event.pointerId, pointerEvent)

    this.callbacks.onPointerMove?.(pointerEvent)
  }

  private handlePointerUp(event: globalThis.PointerEvent) {
    const pointerEvent = this.createPointerEvent(event)
    this.activePointers.delete(event.pointerId)

    this.callbacks.onPointerUp?.(pointerEvent)

    try {
      this.canvas.releasePointerCapture(event.pointerId)
    } catch (e) {
      // すでにリリースされている場合は無視
    }
  }

  setCallbacks(callbacks: {
    onPointerDown?: (event: PointerEvent) => void
    onPointerMove?: (event: PointerEvent) => void
    onPointerUp?: (event: PointerEvent) => void
  }) {
    this.callbacks = callbacks
  }

  getActivePointers(): PointerEvent[] {
    return Array.from(this.activePointers.values())
  }

  destroy() {
    // Canvas上のイベントリスナーを削除
    this.canvas.removeEventListener(
      'pointerdown',
      this.boundHandlers.pointerDown,
    )
    this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart)
    this.canvas.removeEventListener('touchmove', this.boundHandlers.touchMove)
    this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd)

    // Document上のイベントリスナーを削除
    document.removeEventListener('pointermove', this.boundHandlers.pointerMove)
    document.removeEventListener('pointerup', this.boundHandlers.pointerUp)
    document.removeEventListener('pointercancel', this.boundHandlers.pointerUp)

    this.activePointers.clear()
  }
}

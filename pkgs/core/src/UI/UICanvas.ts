// Reference: https://stackoverflow.com/a/56204437

import isIOS from 'is-ios'
import { Emitter } from '@/utils/Emitter'
import { UIStroke, UIStrokePointRequired } from './UIStroke'

type Events = {
  strokeStart: UIStroke
  strokeChange: UIStroke
  strokeComplete: UIStroke
  strokeCancel: UIStroke
}

export class UICanvas extends Emitter<Events> {
  public currentBrush: UIStroke | null = null
  protected ctx: CanvasRenderingContext2D

  #enabled = true

  constructor(public readonly canvas: HTMLCanvasElement) {
    super()
    this.ctx = canvas.getContext('2d')! // settle to 2d context

    this.handleTouchStart = this.handleTouchStart.bind(this)
    this.handleTouchMove = this.handleTouchMove.bind(this)
    this.handleTouchEnd = this.handleTouchEnd.bind(this)
    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseMove = this.handleMouseMove.bind(this)
    this.handleMouseUp = this.handleMouseUp.bind(this)
  }

  public get enabled() {
    return this.#enabled
  }

  public set enabled(v: boolean) {
    this.#enabled = v
  }

  public activate() {
    const passive = { passive: true }

    // Touch Event is used in iOS because PointerEvent cannot be used as a basis for smooth paths.

    this.canvas.addEventListener('touchstart', this.handleTouchStart, passive)
    // this.canvas.addEventListener('touchmove', this.handleTouchMove, passive)
    // this.canvas.addEventListener('touchend', this.handleTouchEnd, passive)
    this.canvas.addEventListener('pointerdown', this.handleMouseDown, passive)
    this.canvas.addEventListener('pointermove', this.handleMouseMove, passive)
    this.canvas.addEventListener('pointerup', this.handleMouseUp, passive)

    return this
  }

  public dispose() {
    this.canvas.removeEventListener('touchstart', this.handleTouchStart)
    // this.canvas.removeEventListener('touchmove', this.handleTouchMove)
    // this.canvas.removeEventListener('touchend', this.handleTouchEnd)
    this.canvas.removeEventListener('pointerdown', this.handleMouseDown)
    this.canvas.removeEventListener('pointermove', this.handleMouseMove)
    this.canvas.removeEventListener('pointerup', this.handleMouseUp)
    this.mitt.all.clear()
  }

  protected handleTouchStart(e: TouchEvent) {
    if (e.touches.length > 1) {
      this.cancelStroke()
      return
    }

    // e.preventDefault()
    // e.stopPropagation()

    // this.currentBrush = null

    // if (e.touches.length > 1) {
    //   this.cancelStroke()
    //   return
    // }

    // const offset = this._getTouchOffset(e)

    // this.startStroke([
    //   {
    //     x: (offset.x * this.ctx.canvas.width) / this.ctx.canvas.clientWidth,
    //     y: (offset.y * this.ctx.canvas.height) / this.ctx.canvas.clientHeight,
    //     pressure: e.touches[0].force,
    //     tilt: null,
    //   },
    // ])
  }

  protected handleTouchMove(e: TouchEvent) {
    e.preventDefault()

    if (e.touches.length > 1) {
      this.cancelStroke()
      return
    }

    // const offset = this._getTouchOffset(e)

    // this.updateStroke([
    //   {
    //     x: (offset.x * this.ctx.canvas.width) / this.ctx.canvas.clientWidth,
    //     y: (offset.y * this.ctx.canvas.height) / this.ctx.canvas.clientHeight,
    //     pressure: e.touches[0].force,
    //     tilt: null,
    //   },
    // ])
  }

  protected handleTouchEnd(e: TouchEvent) {
    e.preventDefault()
    this.finishStroke()
  }

  protected handleMouseDown(e: PointerEvent) {
    if (e.buttons === 0) return

    this.canvas.setPointerCapture(e.pointerId)
    this.startStroke(this.getPointsFromCoalescedEvent(e))
  }

  protected handleMouseMove(e: PointerEvent) {
    if (e.buttons === 0) return

    this.updateStroke(this.getPointsFromCoalescedEvent(e))
  }

  protected handleMouseUp(e: PointerEvent) {
    this.canvas.releasePointerCapture(e.pointerId)
    this.finishStroke()
  }

  protected startStroke(input: UIStrokePointRequired[]) {
    if (!this.#enabled) return

    const s = (this.currentBrush = new UIStroke())
    s.markStartTime()
    input.forEach((p) => s.addPoint(p))

    this.emit('strokeStart', s)
  }

  protected updateStroke(input: UIStrokePointRequired[]) {
    if (!this.#enabled) return

    const s = this.currentBrush
    if (!s) return

    input.forEach((p) => s.addPoint(p))

    this.emit('strokeChange', s)
  }

  protected cancelStroke() {
    if (!this.#enabled) return

    const s = this.currentBrush
    if (!s) return

    this.currentBrush = null
    this.emit('strokeCancel', s)
  }

  protected finishStroke() {
    if (!this.#enabled) return

    const s = this.currentBrush
    if (!s) return

    this.currentBrush = null
    this.emit('strokeComplete', s)
  }

  protected _getTouchOffset = (event: TouchEvent) => {
    const target = event.target as HTMLElement
    const touch = event.touches[0]

    const rect = target.getBoundingClientRect()
    const x = touch.clientX - window.pageXOffset - rect.left
    const y = touch.clientY - window.pageYOffset - rect.top

    return { x, y }
  }

  protected getPointsFromCoalescedEvent(
    e: PointerEvent,
  ): UIStrokePointRequired[] {
    if (!e.getCoalescedEvents) {
      return [
        {
          x: (e.offsetX * this.ctx.canvas.width) / this.ctx.canvas.clientWidth,
          y:
            (e.offsetY * this.ctx.canvas.height) / this.ctx.canvas.clientHeight,
          pressure: e.pressure,
          tilt: { x: e.tiltX, y: e.tiltY },
        },
      ]
    }

    const events = e.getCoalescedEvents()

    if (events.length === 0) {
      return [
        {
          x: (e.offsetX * this.ctx.canvas.width) / this.ctx.canvas.clientWidth,
          y:
            (e.offsetY * this.ctx.canvas.height) / this.ctx.canvas.clientHeight,
          pressure: e.pressure,
          tilt: { x: e.tiltX, y: e.tiltY },
        },
      ]
    }

    return e.getCoalescedEvents().map(
      (e): UIStrokePointRequired => ({
        x: (e.offsetX * this.ctx.canvas.width) / this.ctx.canvas.clientWidth,
        y: (e.offsetY * this.ctx.canvas.height) / this.ctx.canvas.clientHeight,
        pressure: e.pressure,
        tilt: { x: e.tiltX, y: e.tiltY },
        deltaTimeMs: this.currentBrush?.startTime
          ? e.timeStamp - this.currentBrush.startTime
          : 0,
      }),
    )
  }

  public transformPoints() {}
}

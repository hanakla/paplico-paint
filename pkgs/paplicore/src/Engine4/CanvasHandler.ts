// Reference: https://stackoverflow.com/a/56204437

import { PaplicoEngine } from './Engine3'
import { Emitter } from '../Engine3_Emitter'
import { PapSession } from '../Session/Engine3_Sessions'
import { DifferenceRender } from './RenderStrategy/DifferenceRender'
import { Stroke } from './Stroke'
import { setCanvasSize, throttleSingle } from '../utils'
import { deepClone } from '../utils/object'
import { LayerTypes, RasterLayer, VectorLayer, VectorObject } from '../DOM'
import { createContext2D } from '../Engine3_CanvasFactory'
import { Commands } from '../Session/Commands'
import isIOS from 'is-ios'
import { logTime, logTimeEnd } from '../DebugHelper'

type Events = {
  strokeStart: Stroke
  strokeChange: Stroke
  strokeComplete: Stroke
  strokeCancel: Stroke
}

const getTouchOffset = (target: HTMLElement, scale: number, touch: Touch) => {
  const rect = target.getBoundingClientRect()
  const x = (touch.clientX - window.pageXOffset - rect.left) * (1 / scale)
  const y = (touch.clientY - window.pageYOffset - rect.top) * (1 / scale)

  return { x, y }
}

export class CanvasHandler extends Emitter<Events> {
  protected canvas: HTMLCanvasElement
  protected strokeCtx: CanvasRenderingContext2D
  protected compositeSourceCtx: CanvasRenderingContext2D

  protected currentStroke: Stroke | null = null

  protected _scale: number = 1
  protected _stroking: boolean = false

  protected enable = true

  constructor(canvas: HTMLCanvasElement) {
    super()

    this.canvas = canvas
    this.strokeCtx = createContext2D()
    this.compositeSourceCtx = createContext2D()

    const passive = { passive: true }

    // Touch Event is used in iOS because PointerEvent cannot be used as a basis for smooth paths.
    if (isIOS) {
      this.canvas.addEventListener(
        'touchstart',
        this.#handleTouchStart,
        passive
      )
      this.canvas.addEventListener('touchmove', this.#handleTouchMove, passive)
      this.canvas.addEventListener('touchend', this.#handleTouchEnd, passive)
    } else {
      this.canvas.addEventListener(
        'pointerdown',
        this.#handleMouseDown,
        passive
      )
      this.canvas.addEventListener(
        'pointermove',
        this.#handleMouseMove,
        passive
      )
      this.canvas.addEventListener('pointerup', this.#handleMouseUp, passive)
    }

    // window.addEventListener('pointerup', this.#handleMouseUp)
  }

  public dispose() {
    this.canvas.removeEventListener('pointerdown', this.#handleMouseDown)
    this.canvas.removeEventListener('pointermove', this.#handleMouseMove)
    this.canvas.removeEventListener('pointerup', this.#handleMouseUp)

    this.canvas.removeEventListener('touchstart', this.#handleTouchStart)
    this.canvas.removeEventListener('touchmove', this.#handleTouchMove)
    this.canvas.removeEventListener('touchend', this.#handleTouchEnd)
  }

  #handleMouseDown = (e: PointerEvent) => {
    this._stroking = true

    this.canvas.releasePointerCapture(e.pointerId)

    this.currentStroke = new Stroke()
    this.currentStroke.startTime = e.timeStamp
    this.currentStroke.updatePoints((points) => {
      points.push([e.offsetX, e.offsetY, e.pressure, 0])
    })

    this.emit('strokeStart', this.currentStroke)
  }

  #handleMouseMove = (e: PointerEvent) => {
    const { currentStroke } = this

    if (!currentStroke) return
    if (e.buttons === 0) {
      // canceled move with unexpected ignored strokeCancel
      this._stroking = false
      this.currentStroke = null
      return
    }

    currentStroke.updatePoints((points) => {
      if (e.getCoalescedEvents) {
        e.getCoalescedEvents().forEach((e) => {
          points.push([
            e.offsetX,
            e.offsetY,
            e.pressure,
            e.timeStamp - currentStroke!.startTime,
          ])
        })
      } else {
        // Fxxk safari
        points.push([
          e.offsetX,
          e.offsetY,
          e.pressure,
          e.timeStamp - currentStroke!.startTime,
        ])
      }
    })

    console.log('hi')
    // this.currentStroke.path = this.currentStroke.splinedPath
    this.mitt.emit('strokeChange', currentStroke)
  }

  #handleMouseUp = () => {
    const { currentStroke } = this
    if (!currentStroke) return

    this.currentStroke = null
    this._stroking = false

    if (currentStroke.points.length >= 2) {
      this.mitt.emit('strokeComplete', currentStroke)
    }
  }

  #handleTouchStart = (e: TouchEvent) => {
    e.preventDefault()

    this._stroking = true

    if (e.touches.length > 1) {
      const stroke = this.currentStroke!
      this._stroking = false
      this.currentStroke = null
      this.emit('strokeCancel', stroke)
      return
    }

    this.currentStroke = new Stroke()
    this.currentStroke.startTime = e.timeStamp

    const { x, y } = getTouchOffset(
      e.target as HTMLElement,
      this._scale,
      e.touches[0]
    )

    this.currentStroke.updatePoints((points) => {
      points.push([x, y, e.touches[0].force, 0])
    })

    this.emit('strokeStart', this.currentStroke)
  }

  #handleTouchMove = (e: TouchEvent) => {
    const { currentStroke } = this
    if (!currentStroke) return

    const point = getTouchOffset(
      e.target as HTMLElement,
      this._scale,
      e.touches[0]
    )

    currentStroke.updatePoints((points) => {
      points.push([
        point.x,
        point.y,
        e.touches[0].force,
        e.timeStamp - currentStroke!.startTime,
      ])
    })

    this.mitt.emit('strokeChange', currentStroke)
  }

  #handleTouchEnd = (e: TouchEvent) => {
    const { currentStroke } = this
    if (!currentStroke) return

    this.currentStroke = null
    this._stroking = false
    if (currentStroke.points.length >= 2) {
      this.mitt.emit('strokeComplete', currentStroke)
    }
  }
}

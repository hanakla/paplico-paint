import mitt, { Emitter } from 'mitt'
import { Stroke } from './Stroke'
import spline from '@yr/catmull-rom-spline'

type Events = {
  stroke: Stroke
  tmpStroke: Stroke
}

const getTouchOffset = (target: HTMLElement, scale: number, touch: Touch) => {
  const rect = target.getBoundingClientRect()
  const x = (touch.clientX - window.pageXOffset - rect.left) * (1 / scale)
  const y = (touch.clientY - window.pageYOffset - rect.top) * (1 / scale)

  return { x, y }
}

export class CanvasHandler {
  protected canvas: HTMLCanvasElement
  public context: CanvasRenderingContext2D

  protected currentStroke: Stroke | null = null
  protected mitt: Emitter<Events> = mitt()

  protected _scale: number = 1
  protected _stroking: boolean = false

  public on: Emitter<Events>['on']
  public off: Emitter<Events>['off']

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')!

    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    this.canvas.addEventListener('mousedown', (e) => {
      this.currentStroke = new Stroke()
      this.currentStroke.updatePoints((points) => {
        points.push([e.offsetX, e.offsetY, 1])
      })

      this._stroking = true
    })

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.currentStroke) return

      this.currentStroke.updatePoints((points) => {
        points.push([e.offsetX, e.offsetY, 1])
      })

      this.currentStroke.path = this.currentStroke.splinedPath
      this.mitt.emit('tmpStroke', this.currentStroke)
    })

    this.canvas.addEventListener('mouseup', () => {
      const { currentStroke } = this

      if (!currentStroke) return
      if (currentStroke.points.length <= 1) {
        this.currentStroke = null
        this._stroking = false
        return
      }

      this.currentStroke = null
      this._stroking = false

      currentStroke.path = currentStroke.splinedPath
      this.mitt.emit('stroke', currentStroke)
    })

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) return

      this.currentStroke = new Stroke()

      const { x, y } = getTouchOffset(
        e.target as HTMLElement,
        this._scale,
        e.touches[0]
      )

      this._stroking = true

      this.currentStroke.updatePoints((points) => {
        points.push([x, y, e.touches[0].force])
      })
    })

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.currentStroke) return

      if (e.touches.length > 1) {
        // Cancel current stroke when pinch
        this.currentStroke = null
        return
      }

      const { x, y } = getTouchOffset(
        e.target as HTMLElement,
        this._scale,
        e.touches[0]
      )

      this.currentStroke.updatePoints((points) => {
        points.push([x, y, e.touches[0].force])
      })
      this.currentStroke.path = currentStroke.splinedPath

      this.mitt.emit('tmpStroke', this.currentStroke)
    })

    this.canvas.addEventListener('touchend', (e) => {
      const { currentStroke } = this

      if (!currentStroke) return
      if (currentStroke.points.length <= 1) return

      // Cancel current stroke when pinch
      if (e.touches.length > 1) {
        this.currentStroke = null
        this._stroking = false
        return
      }

      this._stroking = false
      this.currentStroke = null

      currentStroke.path = currentStroke.splinedPath
      this.mitt.emit('stroke', currentStroke)
    })
  }

  public get stroking() {
    return this._stroking
  }

  public get scale() {
    return this._scale
  }

  public set scale(scale: number) {
    this._scale = scale
  }
}

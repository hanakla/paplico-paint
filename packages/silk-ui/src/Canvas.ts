import { SilkInternals } from 'silk-core'
import mitt, { Emitter } from 'mitt'

type Events = {
  tmpStroke: { stroke: SilkInternals.Stroke }
  stroke: { stroke: SilkInternals.Stroke }
}

export class Canvas {
  protected canvas: HTMLCanvasElement
  protected container: HTMLElement
  protected mitt: Emitter<Events>

  protected _stroking: boolean = false
  protected _scale: number = 1
  protected currentStroke: SilkInternals.Stroke | null = null
  protected disposers: (() => void)[] = []

  public on: Emitter<Events>['on']
  public off: Emitter<Events>['off']

  constructor({
    canvas,
    container,
  }: {
    canvas: HTMLCanvasElement
    container: HTMLElement
  }) {
    this.canvas = canvas
    this.container = container

    this.mitt = mitt()
    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    this.handleEvents()
  }

  public set scale(scale: number) {
    this.scale = scale
  }

  public get scale() {
    return this.scale
  }

  private handleEvents() {
    const onMouseDown = (e: MouseEvent) => {
      this.currentStroke = new SilkInternals.Stroke()
      this.currentStroke.updatePoints((points) => {
        points.push([e.offsetX, e.offsetY, 1])
      })

      this._stroking = true
    }
    this.canvas.addEventListener('mousedown', onMouseDown)
    this.disposers.push(() =>
      this.canvas.removeEventListener('mousedown', onMouseDown)
    )

    const onMouseMove = (e: MouseEvent) => {
      if (!this.currentStroke) return

      this.currentStroke.updatePoints((points) => {
        points.push([e.offsetX, e.offsetY, 1])
      })

      this.currentStroke.path = this.currentStroke.splinedPath
      this.mitt.emit('tmpStroke', { stroke: this.currentStroke })
    }
    this.canvas.addEventListener('mousemove', onMouseMove)
    this.disposers.push(() =>
      this.canvas.removeEventListener('mousemove', onMouseMove)
    )

    const onMouseUp = () => {
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
      this.mitt.emit('stroke', { stroke: currentStroke })
    }
    this.canvas.addEventListener('mouseup', onMouseUp)
    this.disposers.push(() =>
      this.canvas.removeEventListener('mouseup', onMouseUp)
    )

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return

      this.currentStroke = new SilkInternals.Stroke()

      const { x, y } = getTouchOffset(
        e.target as HTMLElement,
        this._scale,
        e.touches[0]
      )

      this._stroking = true

      this.currentStroke.updatePoints((points) => {
        points.push([x, y, e.touches[0].force])
      })
    }
    this.canvas.addEventListener('touchstart', onTouchStart)
    this.disposers.push(() =>
      this.canvas.removeEventListener('touchstart', onTouchStart)
    )

    const onTouchMove = (e: TouchEvent) => {
      const { currentStroke } = this
      if (!currentStroke) return

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

      currentStroke.updatePoints((points) => {
        points.push([x, y, e.touches[0].force])
      })
      currentStroke.path = currentStroke.splinedPath

      this.mitt.emit('tmpStroke', { stroke: currentStroke })
    }
    this.canvas.addEventListener('touchmove', onTouchMove)
    this.disposers.push(() =>
      this.canvas.removeEventListener('touchmove', onTouchMove)
    )

    const onTouchEnd = (e: TouchEvent) => {
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
      this.mitt.emit('stroke', { stroke: currentStroke })
    }
    this.canvas.addEventListener('touchend', onTouchEnd)
    this.disposers.push(() =>
      this.canvas.removeEventListener('touchend', onTouchEnd)
    )
  }

  public dispose() {
    this.disposers.forEach((d) => d())
  }
}

const getTouchOffset = (target: HTMLElement, scale: number, touch: Touch) => {
  const rect = target.getBoundingClientRect()
  const x = (touch.clientX - window.pageXOffset - rect.left) * (1 / scale)
  const y = (touch.clientY - window.pageYOffset - rect.top) * (1 / scale)

  return { x, y }
}

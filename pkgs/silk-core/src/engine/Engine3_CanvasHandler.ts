import { SilkEngine3 } from './Engine3'
import { Emitter } from '../Engine3_Emitter'
import { Session } from './Engine3_Sessions'
import { DifferenceRender } from './RenderStrategy/DifferenceRender'
import { Stroke } from './Stroke'
import { assign } from '../utils'
import { LayerTypes, RasterLayer, VectorLayer, VectorObject } from '../SilkDOM'

type Events = {
  strokeStart: Stroke
  tmpStroke: Stroke
  strokeComplete: Stroke
  canvasUpdated: void
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

  constructor(canvas: HTMLCanvasElement) {
    super()

    this.canvas = canvas
    this.strokeCtx = document.createElement('canvas').getContext('2d')!
    this.compositeSourceCtx = document.createElement('canvas').getContext('2d')!

    // this.canvas.addEventListener('mousedown', this.#handleMouseDown)
    // this.canvas.addEventListener('mousemove', this.#handleMouseMove)
    // this.canvas.addEventListener('mouseup', this.#handleMouseUp)

    // this.canvas.addEventListener('touchstart', this.#handleTouchStart)
    // this.canvas.addEventListener('touchmove', this.#handleTouchMove)
    // this.canvas.addEventListener('touchend', this.#handleTouchEnd)

    this.canvas.addEventListener('pointerdown', this.#handleMouseDown)
    this.canvas.addEventListener('pointermove', this.#handleMouseMove)
    this.canvas.addEventListener('pointerup', this.#handleMouseUp)

    window.addEventListener('pointerup', this.#handleMouseUp)
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

  public connect(
    session: Session,
    strategy: DifferenceRender = new DifferenceRender(),
    engine: SilkEngine3
  ) {
    const isDrawableLayer = (
      layer: LayerTypes | null
    ): layer is RasterLayer | VectorLayer =>
      layer?.layerType === 'raster' || layer?.layerType === 'vector'

    this.on('strokeStart', async () => {
      const { activeLayer } = session
      if (
        session.pencilMode === 'none' ||
        !session.document ||
        !isDrawableLayer(activeLayer)
      )
        return

      const size = session.document.getLayerSize(activeLayer)
      assign(this.strokeCtx.canvas, size)
      this.strokeCtx.clearRect(0, 0, size.width, size.height)

      strategy.setLayerOverride({
        layerId: activeLayer.id,
        canvas: this.strokeCtx.canvas,
      })
      strategy.markUpdatedLayerId(activeLayer.id)
    })

    this.on('tmpStroke', async (stroke) => {
      const { activeLayer } = session
      if (
        session.pencilMode === 'none' ||
        !session.document ||
        !isDrawableLayer(activeLayer)
      )
        return

      const size = session.document.getLayerSize(activeLayer)
      this.strokeCtx.clearRect(0, 0, size.width, size.height)

      await engine.renderStroke(session, stroke, this.strokeCtx)
      await engine.render(session.document, strategy)
    })

    this.on('strokeComplete', async (stroke) => {
      const { activeLayer } = session
      if (
        session.pencilMode === 'none' ||
        !session.document ||
        !isDrawableLayer(activeLayer)
      )
        return

      const size = session.document.getLayerSize(activeLayer)
      assign(this.strokeCtx.canvas, size)
      assign(this.compositeSourceCtx.canvas, size)
      this.strokeCtx.clearRect(0, 0, size.width, size.height)

      await engine.renderStroke(session, stroke, this.strokeCtx)

      if (activeLayer.layerType === 'raster') {
        this.compositeSourceCtx.drawImage(await activeLayer.imageBitmap, 0, 0)

        engine.compositeLayers(this.strokeCtx, this.compositeSourceCtx, {
          mode: 'normal',
          opacity: 100,
        })

        await activeLayer.updateBitmap((bitmap) => {
          bitmap.set(
            this.compositeSourceCtx.getImageData(
              0,
              0,
              activeLayer!.width,
              activeLayer!.height
            ).data
          )
        })
      } else if (activeLayer.layerType === 'vector') {
        activeLayer.objects.unshift(
          VectorObject.create({
            x: 0,
            y: 0,
            path: stroke.splinedPath,
            brush: { ...session.brushSetting },
          })
        )
      }

      strategy.markUpdatedLayerId(activeLayer.id)
      strategy.setLayerOverride(null)
      await engine.render(session.document, strategy)
      this.mitt.emit('canvasUpdated')
    })
  }

  public dispose() {
    this.canvas.removeEventListener('mousedown', this.#handleMouseDown)
    this.canvas.removeEventListener('mousemove', this.#handleMouseMove)
    this.canvas.removeEventListener('mouseup', this.#handleMouseUp)

    this.canvas.removeEventListener('touchstart', this.#handleTouchStart)
    this.canvas.removeEventListener('touchmove', this.#handleTouchMove)
    this.canvas.removeEventListener('touchend', this.#handleTouchEnd)
  }

  #handleMouseDown = (e: MouseEvent) => {
    this.currentStroke = new Stroke()
    this.currentStroke.updatePoints((points) => {
      points.push([e.offsetX, e.offsetY, 1])
    })

    this.emit('strokeStart', this.currentStroke)

    this._stroking = true
  }

  #handleMouseMove = (e: MouseEvent) => {
    if (!this.currentStroke) return

    this.currentStroke.updatePoints((points) => {
      points.push([e.offsetX, e.offsetY, 1])
    })

    this.currentStroke.path = this.currentStroke.splinedPath
    this.mitt.emit('tmpStroke', this.currentStroke)
  }

  #handleMouseUp = () => {
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
    this.mitt.emit('strokeComplete', currentStroke)
  }

  #handleTouchStart = (e: TouchEvent) => {
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

    this.emit('strokeStart', this.currentStroke)
  }

  #handleTouchMove = (e: TouchEvent) => {
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

    this.mitt.emit('tmpStroke', currentStroke)
  }

  #handleTouchEnd = (e: TouchEvent) => {
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
    this.mitt.emit('strokeComplete', currentStroke)
  }
}

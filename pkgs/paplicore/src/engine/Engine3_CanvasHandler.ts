import { PaplicoEngine } from './Engine3'
import { Emitter } from '../Engine3_Emitter'
import { PapSession } from '../Session/Engine3_Sessions'
import { DifferenceRender } from './RenderStrategy/DifferenceRender'
import { Stroke } from './Stroke'
import { setCanvasSize } from '../utils'
import { deepClone } from '../utils/object'
import { LayerTypes, RasterLayer, VectorLayer, VectorObject } from '../DOM'
import { createContext2D } from '../Engine3_CanvasFactory'
import { Commands } from '../Session/Commands'
import isIOS from 'is-ios'

type Events = {
  strokeStart: Stroke
  strokeChange: Stroke
  strokeComplete: Stroke
  strokeCancel: Stroke

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
  #strokingState: { touches: number } = { touches: 0 }

  constructor(canvas: HTMLCanvasElement) {
    super()

    this.canvas = canvas
    this.strokeCtx = createContext2D()
    this.compositeSourceCtx = createContext2D()

    const passive = { passive: true }

    // Touch Event is used in iOS because Pointer Event cannot be used as a basis for smooth paths.
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
    session: PapSession,
    strategy: DifferenceRender = new DifferenceRender(),
    engine: PaplicoEngine
  ) {
    const isDrawableLayer = (
      layer: LayerTypes | null
    ): layer is RasterLayer | VectorLayer =>
      layer?.layerType === 'raster' ||
      (layer?.layerType === 'vector' &&
        layer.lock === false &&
        layer.visible === true)

    session.on('documentChanged', (s) => {
      if (s.document == null) return
      setCanvasSize(this.strokeCtx.canvas, s.document)
    })

    this.on('strokeStart', async () => {
      const { activeLayer } = session
      if (
        session.pencilMode === 'none' ||
        !session.document ||
        !isDrawableLayer(activeLayer)
      )
        return

      const size = session.document.getLayerSize(activeLayer)
      setCanvasSize(this.strokeCtx.canvas, size)
      this.strokeCtx.clearRect(0, 0, size.width, size.height)

      strategy.setLayerOverride({
        layerId: activeLayer.uid,
        context2d: this.strokeCtx,
        compositeMode:
          session.pencilMode === 'draw' ? 'normal' : 'destination-out',
      })
      strategy.markUpdatedLayerId(activeLayer.uid)
    })

    this.on('strokeChange', async (stroke) => {
      const { activeLayer } = session
      if (
        session.pencilMode === 'none' ||
        !session.document ||
        !isDrawableLayer(activeLayer)
      )
        return

      const size = session.document.getLayerSize(activeLayer)
      this.strokeCtx.clearRect(0, 0, size.width, size.height)

      await engine.renderPath(
        session.brushSetting,
        session.currentInk,
        stroke.splinedPath.getSimplifiedPath(),
        this.strokeCtx,
        { hintInput: null }
      )

      await engine.render(session.document, strategy)
    })

    this.on('strokeComplete', async (stroke) => {
      const { activeLayer, activeLayerPath } = session

      if (!activeLayerPath) return
      if (
        session.pencilMode === 'none' ||
        !session.document ||
        !isDrawableLayer(activeLayer)
      )
        return

      const size = session.document.getLayerSize(activeLayer)
      setCanvasSize(this.strokeCtx.canvas, size)
      setCanvasSize(this.compositeSourceCtx.canvas, size)
      this.strokeCtx.clearRect(0, 0, size.width, size.height)

      if (activeLayer.layerType === 'raster') {
        this.compositeSourceCtx.drawImage(await activeLayer.imageBitmap, 0, 0)

        await engine.renderPath(
          session.brushSetting,
          session.currentInk,
          stroke.splinedPath.getSimplifiedPath(),
          this.strokeCtx,
          { hintInput: await activeLayer.imageBitmap }
        )

        engine.compositeLayers(this.strokeCtx, this.compositeSourceCtx, {
          mode: session.pencilMode === 'draw' ? 'normal' : 'destination-out',
          opacity: 100,
        })

        await session.runCommand(
          new Commands.RasterLayer.UpdateBitmap({
            pathToTargetLayer: activeLayerPath,
            update: (bitmap) => {
              bitmap.set(
                this.compositeSourceCtx.getImageData(
                  0,
                  0,
                  activeLayer!.width,
                  activeLayer!.height
                ).data
              )
            },
          })
        )
      } else if (activeLayer.layerType === 'vector') {
        session.runCommand(
          new Commands.VectorLayer.AddObject({
            pathToTargetLayer: activeLayerPath,
            object: VectorObject.create({
              x: 0,
              y: 0,
              path: stroke.splinedPath.getSimplifiedPath(),
              fill: null,
              brush:
                session.brushSetting == null
                  ? null
                  : deepClone(session.brushSetting),
            }),
          })
        )
      }

      strategy.markUpdatedLayerId(activeLayer.uid)
      strategy.setLayerOverride(null)
      engine.lazyRender(session.document, strategy)
      this.mitt.emit('canvasUpdated')
    })

    this.on('strokeCancel', async () => {
      strategy.setLayerOverride(null)
    })

    session.on('documentChanged', () => {
      setCanvasSize(this.canvas, session.document!)
    })
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

    // this.currentStroke.path = this.currentStroke.splinedPath
    this.mitt.emit('strokeChange', currentStroke)
  }

  #handleMouseUp = () => {
    const { currentStroke } = this
    if (!currentStroke) return

    if (currentStroke.points.length < 2) {
      this.currentStroke = null
      this._stroking = false
      return
    }

    this.mitt.emit('strokeComplete', currentStroke)
  }

  #handleTouchStart = (e: TouchEvent) => {
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
    if (!currentStroke || !this.#strokingState) return

    if (currentStroke.points.length < 2) {
      this.currentStroke = null
      this._stroking = false
      return
    }

    this.mitt.emit('strokeComplete', currentStroke)
  }
}

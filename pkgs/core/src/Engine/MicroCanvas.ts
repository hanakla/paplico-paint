import { Paplico } from '@/Engine/Paplico'
import { UICanvas } from '@/UI/UICanvas'
import { UIStroke } from '@/UI/UIStroke'
import { Canvas2DAllocator } from './Canvas2DAllocator'
import { DEFAULT_INK_SETTING, DEFAULT_STROKE_SETTING } from './constants'
import { deepClone } from '@/utils/object'
import { clearCanvas, setCanvasSize } from '@/utils/canvas'
import { DisposedInstanceError } from '@/Errors/DisposedInstanceError'
import { Emitter } from '@/utils/Emitter'

export namespace MicroCanvas {
  export type Events = {
    contentUpdated: void
  }
}

/**
 * An draw only minimal paplico canvas (for brush preview and sub tools usage)
 * create this instance from `Paplico#createMicroCanvas`
 */
export class MicroCanvas extends Emitter<MicroCanvas.Events> {
  protected destCanvas: HTMLCanvasElement
  protected destcx: CanvasRenderingContext2D

  protected paplico: Paplico
  protected uiCanvas: UICanvas

  protected commitedCx: CanvasRenderingContext2D | null

  protected strokeSetting: Paplico.StrokeSetting | null =
    DEFAULT_STROKE_SETTING()
  protected inkSetting: Paplico.InkSetting = DEFAULT_INK_SETTING()
  protected fillSetting: Paplico.FillSetting | null = null

  public _enabled = true

  #disposed = false

  /**
   * @param canvas target canvas to display
   */
  constructor(canvas: HTMLCanvasElement, paplico: Paplico) {
    super()

    this.destCanvas = canvas
    this.destcx = canvas.getContext('2d')!

    this.paplico = paplico
    this.uiCanvas = new UICanvas(canvas)
    this.commitedCx = Canvas2DAllocator.borrow({
      width: canvas.width,
      height: canvas.height,
    })

    this.onStrokeChange = this.onStrokeChange.bind(this)
    this.onStrokeComplete = this.onStrokeComplete.bind(this)
  }

  public dispose() {
    disposeCheck(this.#disposed)

    Canvas2DAllocator.release(this.commitedCx)
    this.commitedCx = null!
    this.uiCanvas.dispose()
    this.#disposed = true
  }

  protected bindListerners() {
    this.uiCanvas.activate()
    this.uiCanvas.on('strokeChange', this.onStrokeChange)
    this.uiCanvas.on('strokeCancel', this.onStrokeCancel)
    this.uiCanvas.on('strokeComplete', this.onStrokeComplete)
  }

  public get enabled() {
    return this._enabled
  }

  public set enabled(enabled: boolean) {
    this._enabled = enabled
  }

  public setSize(width: number, height: number) {
    disposeCheck(this.#disposed)

    setCanvasSize(this.destCanvas, width, height)
    setCanvasSize(this.commitedCx!.canvas, width, height)
  }

  public getStrokeSetting() {
    return deepClone(this.strokeSetting)
  }

  public setStrokeSetting(setting: Paplico.StrokeSetting | null) {
    this.strokeSetting = setting
  }

  public getInkSetting() {
    return deepClone(this.inkSetting)
  }

  public setInkSetting(setting: Paplico.InkSetting) {
    this.inkSetting = setting
  }

  public getFillSetting() {
    return deepClone(this.fillSetting)
  }

  public setFillSetting(setting: Paplico.FillSetting) {
    this.fillSetting = setting
  }

  protected onStrokeChange(stroke: UIStroke) {
    disposeCheck(this.#disposed)
    if (!this._enabled) return

    const buf = Canvas2DAllocator.borrow({
      width: this.destCanvas.width,
      height: this.destCanvas.height,
    })

    try {
      this.paplico.renderPathInto(stroke.toPath(), buf, {
        compositeMode: 'normal',
        strokeSetting: this.strokeSetting,
        inkSetting: this.inkSetting,
        fillSetting: this.fillSetting,
        order: 'stroke-first',
      })

      clearCanvas(this.destcx)
      this.destcx.drawImage(this.commitedCx!.canvas, 0, 0)
      this.destcx.drawImage(buf.canvas, 0, 0)
    } finally {
      Canvas2DAllocator.release(buf)
    }
  }

  protected onStrokeCancel() {
    disposeCheck(this.#disposed)
    if (!this._enabled) return

    clearCanvas(this.destcx)
    this.destcx.drawImage(this.commitedCx!.canvas, 0, 0)
  }

  protected onStrokeComplete(stroke: UIStroke) {
    disposeCheck(this.#disposed)
    if (!this._enabled) return

    this.paplico.renderPathInto(stroke.toPath(), this.commitedCx!, {
      compositeMode: 'normal',
      strokeSetting: this.strokeSetting,
      inkSetting: this.inkSetting,
      fillSetting: this.fillSetting,
      order: 'stroke-first',
    })

    clearCanvas(this.destcx)
    this.destcx.drawImage(this.commitedCx!.canvas, 0, 0)

    this.emit('contentUpdated', undefined)
  }
}

const disposeCheck = (disposed: boolean) => {
  if (disposed) throw new DisposedInstanceError()
}

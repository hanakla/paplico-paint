import { Paplico } from '@/Engine/Paplico'
import { UICanvas } from '@/UI/UICanvas'
import { UIStroke } from '@/UI/UIStroke'
import { Canvas2DAllocator } from './Canvas2DAllocator'
import { DEFAULT_INK_SETTING, DEFAULT_BRUSH_SETTING } from './constants'
import { deepClone } from '@/utils/object'
import { clearCanvas, setCanvasSize } from '@/utils/canvas'
import { DisposedInstanceError } from '@/Errors/DisposedInstanceError'
import { Emitter } from '@/utils/Emitter'
import { VectorPath } from '@/Document'

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
  // protected history: MicroCanvasHistory = new MicroCanvasHistory()

  protected brushSetting: Paplico.BrushSetting | null = DEFAULT_BRUSH_SETTING()
  protected inkSetting: Paplico.InkSetting = DEFAULT_INK_SETTING()
  protected fillSetting: Paplico.FillSetting | null = null

  protected _inputEnabled = true

  #disposed = false

  /**
   * @param canvas target canvas to display
   */
  constructor(canvas: HTMLCanvasElement, paplico: Paplico) {
    super()

    console.log('micro canvas')
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

    this.bindListeners()
  }

  public dispose() {
    disposeCheck(this.#disposed)

    Canvas2DAllocator.return(this.commitedCx)
    this.commitedCx = null!
    this.uiCanvas.dispose()
    this.#disposed = true
  }

  protected bindListeners() {
    this.uiCanvas.activate()
    this.uiCanvas.on('strokeChange', this.onStrokeChange)
    this.uiCanvas.on('strokeCancel', this.onStrokeCancel)
    this.uiCanvas.on('strokeComplete', this.onStrokeComplete)
  }

  public get inputEnabled() {
    return this._inputEnabled
  }

  public set inputEnabled(enabled: boolean) {
    this._inputEnabled = enabled
  }

  public setSize(width: number, height: number) {
    disposeCheck(this.#disposed)

    setCanvasSize(this.destCanvas, width, height)
    setCanvasSize(this.commitedCx!.canvas, width, height)
  }

  public getBrushSetting() {
    return deepClone(this.brushSetting)
  }

  public setBrushSetting(setting: Paplico.BrushSetting | null) {
    this.brushSetting = setting
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

  public async drawPathPreview(
    path: VectorPath,
    options: Paplico.RenderPathIntoOptions = {
      brushSetting: this.brushSetting,
      fillSetting: this.fillSetting,
    },
  ) {
    disposeCheck(this.#disposed)
    if (!this._inputEnabled) return

    const buf = Canvas2DAllocator.borrow({
      width: this.destCanvas.width,
      height: this.destCanvas.height,
    })

    try {
      await this.drawPathInto(path, buf, {
        blendMode: options.blendMode,
        brushSetting: options.brushSetting ?? this.brushSetting,
        inkSetting: options.inkSetting ?? this.inkSetting,
        fillSetting: options.fillSetting ?? this.fillSetting,
        order: options.order ?? 'stroke-first',
      })

      clearCanvas(this.destcx)
      this.destcx.drawImage(this.commitedCx!.canvas, 0, 0)
      this.destcx.drawImage(buf.canvas, 0, 0)
    } finally {
      Canvas2DAllocator.return(buf)
    }
  }

  public async drawPath(
    path: VectorPath,
    options: Paplico.RenderPathIntoOptions = {
      brushSetting: this.brushSetting,
      fillSetting: this.fillSetting,
    },
  ) {
    disposeCheck(this.#disposed)

    await this.drawPathInto(path, this.commitedCx!, {
      blendMode: options.blendMode,
      brushSetting: options.brushSetting ?? this.brushSetting,
      inkSetting: options.inkSetting ?? this.inkSetting,
      fillSetting: options.fillSetting ?? this.fillSetting,
      order: options.order ?? 'stroke-first',
    })

    clearCanvas(this.destcx)
    this.destcx.drawImage(this.commitedCx!.canvas, 0, 0)

    this.emit('contentUpdated', undefined)
  }

  protected clearPreview() {
    disposeCheck(this.#disposed)

    clearCanvas(this.destcx)
    this.destcx.drawImage(this.commitedCx!.canvas, 0, 0)
  }

  protected onStrokeChange(stroke: UIStroke) {
    disposeCheck(this.#disposed)
    if (!this._inputEnabled) return

    this.drawPathPreview(stroke.toPath())
  }

  protected onStrokeComplete(stroke: UIStroke) {
    disposeCheck(this.#disposed)
    if (!this._inputEnabled) return

    this.drawPath(stroke.toPath())
  }

  protected onStrokeCancel() {
    disposeCheck(this.#disposed)
    if (!this._inputEnabled) return

    clearCanvas(this.destcx)
    this.destcx.drawImage(this.commitedCx!.canvas, 0, 0)
  }

  protected async drawPathInto(
    path: VectorPath,
    destination: CanvasRenderingContext2D,
    {
      blendMode,
      brushSetting,
      inkSetting,
      fillSetting,
      order,
    }: Paplico.RenderPathIntoOptions,
  ) {
    disposeCheck(this.#disposed)

    await this.paplico.renderPathInto(path, destination, {
      blendMode,
      brushSetting: brushSetting ?? this.brushSetting,
      inkSetting,
      fillSetting,
      order,
    })
  }
}

const disposeCheck = (disposed: boolean) => {
  if (disposed) throw new DisposedInstanceError()
}

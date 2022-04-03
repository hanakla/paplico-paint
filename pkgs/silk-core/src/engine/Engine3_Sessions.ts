import { nanoid } from 'nanoid'

import { Document, LayerTypes } from '../SilkDOM'
import { Brush } from '../Brushes'
import { CurrentBrushSetting } from './CurrentBrushSetting'
import { Emitter } from '../Engine3_Emitter'
import { RandomInk } from './Inks/RandomInk'
import { IInk } from './Inks/IInk'
import { IBrush } from './IBrush'
import { IRenderStrategy } from './RenderStrategy/IRenderStrategy'
import { RenderStrategies } from './RenderStrategy'
import { BrushSetting } from '../Value'
import { SilkEngine3 } from './Engine3'
import { assign } from '../utils'

type Events = {
  documentChanged: Session
  activeLayerChanged: Session
  blushChanged: Session
  blushSettingChanged: Session
  renderSettingChanged: Session
  disposed: void
}

type PencilMode = 'none' | 'draw' | 'erase'

export class Session extends Emitter<Events> {
  public readonly sid: string = nanoid()
  public renderStrategy: IRenderStrategy = new RenderStrategies.FullRender()

  public renderSetting: SilkEngine3.RenderSetting = {
    disableAllFilters: false,
    updateThumbnail: true,
  }

  protected _currentBrush: IBrush = new Brush()
  protected _currentInk: IInk = new RandomInk()
  protected _activeLayer: LayerTypes | null = null
  protected _brushSetting: CurrentBrushSetting = {
    brushId: Brush.id,
    weight: 1,
    color: { r: 0, g: 0, b: 0 },
    opacity: 1,
  }
  protected _pencilMode: PencilMode = 'draw'
  protected blushPromise: Promise<void> | null = null

  constructor(public document: Document | null = null) {
    super()
  }

  public setDocument(document: Document | null) {
    this.document = document
    this.mitt.emit('documentChanged', this)
  }

  public setRenderStrategy(strategy: IRenderStrategy) {
    this.renderStrategy = strategy
  }

  public setRenderSetting(setting: Partial<SilkEngine3.RenderSetting>) {
    assign(this.renderSetting, setting)
    this.emit('renderSettingChanged', this)
  }

  public get activeLayer() {
    return this._activeLayer
  }

  public get activeLayerId(): string | undefined | null {
    return this._activeLayer?.id
  }

  public set activeLayerId(value: string | undefined | null) {
    this._activeLayer =
      this.document?.layers.find((layer) => layer.id === value) ?? null

    this.emit('activeLayerChanged', this)
  }

  public get currentBursh() {
    return this._currentBrush
  }

  public set currentBursh(brush: IBrush) {
    this._currentBrush = brush
    this.emit('blushChanged', this)
  }

  public get pencilMode() {
    return this._pencilMode
  }

  public set pencilMode(next: PencilMode) {
    this._pencilMode = next
  }

  public get brushSetting() {
    return this._brushSetting
  }

  public set brushSetting(value: BrushSetting) {
    this._brushSetting = value
    this.emit('blushSettingChanged', this)
  }

  public get currentInk() {
    return this._currentInk
  }

  public get currentLayerBBox() {
    if (!this._activeLayer) return null

    return {
      x: this._activeLayer.x,
      y: this._activeLayer.y,
      width: this._activeLayer.width,
      height: this._activeLayer.height,
    }
  }

  public dispose() {
    this.emit('disposed')
  }
}

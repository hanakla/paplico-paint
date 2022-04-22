import { nanoid } from 'nanoid'

import { Document, LayerTypes } from '../SilkDOM'
import { Brush } from '../Brushes'
import { CurrentBrushSetting } from '../engine/CurrentBrushSetting'
import { Emitter } from '../Engine3_Emitter'
import { RandomInk } from '../Inks/RandomInk'
import { IInk } from '../Inks/IInk'
import { IRenderStrategy } from '../engine/RenderStrategy/IRenderStrategy'
import { RenderStrategies } from '../engine/RenderStrategy'
import { BrushSetting } from '../Value'
import { SilkEngine3 } from '../engine/Engine3'
import { assign } from '../utils'
import { ICommand } from './ICommand'
import { SilkDOMDigger } from '../SilkDOMDigger'

type Events = {
  documentChanged: SilkSession
  activeLayerChanged: SilkSession
  brushChanged: SilkSession
  brushSettingChanged: SilkSession
  renderSettingChanged: SilkSession
  disposed: void
}

type PencilMode = 'none' | 'draw' | 'erase'

export declare namespace SilkSession {
  export type BrushSetting = CurrentBrushSetting
}

/**
 * Indicates Editor states
 */
export class SilkSession extends Emitter<Events> {
  public static async create() {
    return new SilkSession()
  }

  public readonly sid: string = nanoid()
  public renderStrategy: IRenderStrategy = new RenderStrategies.FullRender()

  public renderSetting: SilkEngine3.RenderSetting = {
    disableAllFilters: false,
    updateThumbnail: true,
  }

  protected _currentInk: IInk = new RandomInk()
  protected _activeLayer: LayerTypes | null = null
  protected _brushSetting: CurrentBrushSetting = {
    brushId: Brush.id,
    size: 1,
    color: { r: 0, g: 0, b: 0 },
    opacity: 1,
  }
  protected _pluginSpecificBrushSettings: {
    [blushId: string]: Record<string, any>
  } = Object.create(null)

  protected _pencilMode: PencilMode = 'draw'
  protected blushPromise: Promise<void> | null = null

  public commandHistory: ICommand[] = []
  public redoHistory: ICommand[] = []
  // protected currentCommandTransaction = []

  public historyLimit = 30

  protected constructor(public document: Document | null = null) {
    super()

    if (process.env.NODE_ENV === 'development') {
      this.on('*', (e) => console.log('session: ', e))
    }
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

  public setBrushSetting(setting: Partial<SilkSession.BrushSetting>) {
    assign(this.brushSetting, setting)
    this.emit('brushSettingChanged', this)
  }

  public setSpecificBrushSetting<T extends Record<string, any>>(
    brushId: string,
    option: Partial<T>
  ) {
    const options = (this._pluginSpecificBrushSettings[brushId] ??=
      Object.create(null))
    assign(options, option)
  }

  public getSpecificBrushSetting<T extends Record<string, any>>(
    brushId: string
  ): T | null {
    return (this._pluginSpecificBrushSettings[brushId] as any) ?? null
  }

  public setActiveLayer(path: string | string[] | null) {
    this._activeLayer =
      path && this.document
        ? SilkDOMDigger.findLayer(
            this.document,
            Array.isArray(path) ? path : [path]
          )
        : null

    this.emit('activeLayerChanged', this)
  }

  public async runCommand(com: ICommand) {
    if (!this.document) return

    await com.do(this.document)

    this.commandHistory.push(com)
    this.commandHistory = this.commandHistory.slice(-this.historyLimit)
    this.redoHistory = []
  }

  public async undo() {
    if (!this.document) return

    const [cmd] = this.commandHistory.splice(-1)
    await cmd.undo(this.document)
    this.redoHistory.push(cmd)

    return cmd
  }

  public async redo() {
    if (!this.document) return

    const [cmd] = this.redoHistory.splice(-1)
    await cmd.redo(this.document)
    this.commandHistory.push(cmd)

    return cmd
  }

  public get activeLayer() {
    return this._activeLayer
  }

  /** @deprecated */
  public get activeLayerId(): string | undefined | null {
    return this._activeLayer?.uid
  }

  /** @deprecated */
  public set activeLayerId(value: string | undefined | null) {
    this._activeLayer =
      this.document?.layers.find((layer) => layer.uid === value) ?? null

    this.emit('activeLayerChanged', this)
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
    this.emit('brushSettingChanged', this)
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

  public getDocumentUsedMemoryBytes() {
    let sumBytes = 0

    if (this.document) {
      const traverse = (layers: readonly LayerTypes[]) => {
        for (const layer of layers) {
          switch (layer.layerType) {
            case 'raster': {
              console.log()
              sumBytes += layer.bitmap.byteLength
              break
            }
          }

          if ('layers' in layer) traverse(layer.layers)
        }
      }

      traverse(this.document.layers)
    }

    return sumBytes
  }

  public dispose() {
    this.emit('disposed')
  }
}

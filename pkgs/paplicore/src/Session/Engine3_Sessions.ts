import { nanoid } from 'nanoid'

import { Document, LayerTypes } from '../DOM'
import { Brush } from '../Brushes'
import { CurrentBrushSetting } from '../engine/CurrentBrushSetting'
import { Emitter } from '../Engine3_Emitter'
import { RandomInk } from '../Inks/RandomInk'
import { IInk } from '../Inks/IInk'
import { IRenderStrategy } from '../engine/RenderStrategy/IRenderStrategy'
import { RenderStrategies } from '../engine/RenderStrategy'
import { BrushSetting } from '../Value'
import { PaplicoEngine } from '../engine/Engine3'
import { assign } from '../utils'
import { ICommand } from './ICommand'
import { CommandHooks, CommandHook, CommandHookEvent } from './CommandHooks'
import { PapDOMDigger } from '../PapDOMDigger'

type Events = {
  documentChanged: PapSession
  activeLayerChanged: PapSession
  brushChanged: PapSession
  brushSettingChanged: PapSession
  renderSettingChanged: PapSession
  historyChanged: PapSession
  disposed: void
}

type PencilMode = 'none' | 'draw' | 'erase'

export declare namespace PapSession {
  export type {
    CommandHookEvent,
    CommandHook,
    CurrentBrushSetting as BrushSetting,
  }
}

/**
 * Indicates Editor states
 */
export class PapSession extends Emitter<Events> {
  public static async create() {
    return new PapSession()
  }

  public readonly sid: string = nanoid()
  public renderStrategy: IRenderStrategy = new RenderStrategies.FullRender()

  public renderSetting: PaplicoEngine.RenderSetting = {
    disableAllFilters: false,
    updateThumbnail: true,
  }

  protected _currentInk: IInk = new RandomInk()
  protected _activeLayer: LayerTypes | null = null
  protected _activeLayerPath: string[] | null = null
  protected _brushSetting: CurrentBrushSetting = {
    brushId: Brush.id,
    size: 1,
    color: { r: 0, g: 0, b: 0 },
    opacity: 1,
    specific: {},
  }
  protected _pluginSpecificBrushSettings: {
    [blushId: string]: Record<string, any>
  } = Object.create(null)

  protected _pencilMode: PencilMode = 'draw'
  protected blushPromise: Promise<void> | null = null

  public commandHistory: ICommand[] = []
  public redoHistory: ICommand[] = []
  // protected currentCommandTransaction = []
  public commandHook = new CommandHooks()

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

  public setRenderSetting(setting: Partial<PaplicoEngine.RenderSetting>) {
    assign(this.renderSetting, setting)
    this.emit('renderSettingChanged', this)
  }

  public setBrushSetting(setting: Partial<PapSession.BrushSetting>) {
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

  public setActiveLayer(path: string[] | null) {
    if (!path) {
      this._activeLayer = null
      this._activeLayerPath = null
    } else {
      this._activeLayer = this.document
        ? PapDOMDigger.findLayer(
            this.document,
            Array.isArray(path) ? path : [path]
          )
        : null
    }

    if (this._activeLayer) {
      this._activeLayerPath = path
    }

    this.emit('activeLayerChanged', this)
  }

  public get undoStackCount() {
    return this.commandHistory.length
  }

  public get redoStackCount() {
    return this.redoHistory.length
  }

  public async runCommand(com: ICommand) {
    if (!this.document) return

    await com.do(this.document)

    this.commandHistory.push(com)
    this.commandHistory = this.commandHistory.slice(-this.historyLimit)
    this.redoHistory = []

    this.emit('historyChanged', this)
  }

  public async undo() {
    if (!this.document) return

    const [cmd] = this.commandHistory.splice(-1)
    if (!cmd) return

    await cmd.undo(this.document)
    this.redoHistory.push(cmd)

    this.emit('historyChanged', this)

    return cmd
  }

  public async redo() {
    if (!this.document) return

    const [cmd] = this.redoHistory.splice(-1)
    if (!cmd) return

    await cmd.redo(this.document)
    this.commandHistory.push(cmd)

    this.emit('historyChanged', this)

    return cmd
  }

  public get activeLayer() {
    return this._activeLayer
  }

  public get activeLayerPath() {
    return this._activeLayerPath
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

import { Emitter } from 'Engine3_Emitter'

export type CompositeMode = 'normal' | 'multiply' | 'screen' | 'overlay'

export type LayerEvents<T extends ILayer> = {
  updated: T
}

export interface ILayer extends Emitter<LayerEvents<any>> {
  layerType: 'raster' | 'vector' | 'filter' | 'group' | 'text'
  name: string
  visible: boolean
  lock: boolean
  compositeMode: CompositeMode
  /** 0 to 100 */
  opacity: number

  width: number
  height: number
  x: number
  y: number

  update(proc: (layer: this) => void): void

  serialize(): any
}

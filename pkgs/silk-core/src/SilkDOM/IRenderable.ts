import { Emitter } from 'Engine3_Emitter'
import { ISilkDOMElement } from './ISilkDOMElement'

export type CompositeMode = 'normal' | 'multiply' | 'screen' | 'overlay'

export type LayerEvents<T extends ILayer> = {
  updated: T
}

export type LayerProperties = {
  uid: string
  layerType: 'raster' | 'vector' | 'filter' | 'group' | 'text' | 'reference'
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
}

export interface ILayer
  extends Emitter<LayerEvents<any>>,
    LayerProperties,
    ISilkDOMElement {
  update(proc: (layer: this) => void): void

  serialize(): any
  clone(): this
}

import { type Emitter } from '../Engine3_Emitter'
import { type ISilkDOMElement } from './ISilkDOMElement'

export type CompositeMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'clipper'

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

export declare namespace ILayer {
  export type Attributes = LayerProperties
  export type SerializedAttributes = LayerProperties
}

export interface ILayer
  // Emitter<LayerEvents<any>>,
  extends LayerProperties,
    ISilkDOMElement {
  update(proc: (layer: this) => void): void

  serialize(): any
  clone(): this
}

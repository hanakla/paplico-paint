import { type Emitter } from '../Engine3_Emitter'
import { type ISilkDOMElement } from './ISilkDOMElement'
import { FeatureTagMixin } from './internal/featureTag'

export type LayerEvents<T extends ILayer> = {
  updated: T
}

type LayerAttributes = {
  uid: string
  layerType: 'raster' | 'vector' | 'filter' | 'group' | 'text' | 'reference'
  name: string
  visible: boolean
  lock: boolean
  compositeMode: CompositeMode
  /** 0 to 100 */
  opacity: number

  x: number
  y: number

  features: { [featureName: string]: Record<string, any> }
}

export declare namespace ILayer {
  export type Attributes = LayerAttributes
  export type SerializedAttributes = LayerAttributes
}

export interface ILayer
  // Emitter<LayerEvents<any>>,
  extends LayerAttributes,
    ISilkDOMElement {
  update(proc: (layer: this) => void): void

  hasFeature: FeatureTagMixin.HasFeature
  enableFeature: FeatureTagMixin.EnableFeature
  getFeatureSetting: FeatureTagMixin.GetFeatureSetting
  patchFeatureSetting: FeatureTagMixin.PatchFeatureSetting

  serialize(): any
  clone(): this
}

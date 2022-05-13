import { features } from 'process'
import { assign } from '../../utils/object'
import { ILayer } from '../ILayer'
import { LayerTypes } from '../index'

// import * as featureTag from './internal/featureTag'
// public hasFeature = featureTag.hasFeature
// public enableFeature = featureTag.enableFeature
// public getFeatureSetting = featureTag.getFeatureSetting
// public patchFeatureSetting = featureTag.patchFeatureSetting

/**
 * Custom view feature controlls.
 * Settinng contents defined at frontend side.
 * And when have provided feature enabled, handle this in frontend.
 */
export declare namespace FeatureTagMixin {
  export type HasFeature = (this: ILayer, feature: string) => boolean

  export type EnableFeature = <T extends Record<string, any>>(
    this: ILayer,
    feature: string,
    initialConfig: T
  ) => void

  export type GetFeatureSetting = <T extends Record<string, any>>(
    this: ILayer,
    feature: string
  ) => T | undefined

  export type PatchFeatureSetting = <T extends Record<string, any>>(
    this: ILayer,
    feature: string,
    settings: T
  ) => void
}

export const hasFeature: FeatureTagMixin.HasFeature = function (
  this: ILayer,
  feature: string
): boolean {
  return Object.prototype.hasOwnProperty.call(this.features[feature], feature)
}

export const enableFeature: FeatureTagMixin.EnableFeature = function (
  feature,
  initialSetting
) {
  if (this.features[feature] != null)
    throw new Error(`Paplico: Feature ${feature} already enabled.`)
  this.features[feature] = initialSetting
}

export const getFeatureSetting: FeatureTagMixin.GetFeatureSetting = function <
  T extends Record<string, any>
>(this: ILayer, feature: string): T | undefined {
  return this.features[feature] as T | undefined
}

export const patchFeatureSetting: FeatureTagMixin.PatchFeatureSetting =
  function <T extends Record<string, any>>(
    this: ILayer,
    feature: string,
    patch: Partial<T>
  ) {
    assign(this.features[feature], patch)
  }

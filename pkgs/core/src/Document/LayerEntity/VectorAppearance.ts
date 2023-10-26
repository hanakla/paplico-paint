import { VectorStrokeSetting } from './VectorStrokeSetting'
import { VectorFillSetting } from './VectorFillSetting'
import { VectorExternalAppearanceSetting } from './VectorExternalAppearanceSetting'
import { InkSetting } from './InkSetting'

export type VectorAppearanceStroke = {
  uid: string
  kind: 'stroke'
  stroke: VectorStrokeSetting
  ink: InkSetting
}

export type VectorAppearanceFill = {
  uid: string
  kind: 'fill'
  fill: VectorFillSetting
}

export type VectorAppearanceExternal = {
  uid: string
  kind: 'external'
  processor: VectorExternalAppearanceSetting<any>
}

export type VectorAppearance =
  | VectorAppearanceStroke
  | VectorAppearanceFill
  | VectorAppearanceExternal

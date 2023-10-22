import { VectorStrokeSetting } from './VectorStrokeSetting'
import { VectorFillSetting } from './VectorFillSetting'
import { VectorExternalAppearanceSetting } from './VectorExternalAppearanceSetting'
import { InkSetting } from './InkSetting'

export type VectorAppearanceStroke = {
  kind: 'stroke'
  stroke: VectorStrokeSetting
  ink: InkSetting
}

export type VectorAppearanceFill = {
  kind: 'fill'
  fill: VectorFillSetting
}

export type VectorAppearanceExternal = {
  kind: 'external'
  processor: VectorExternalAppearanceSetting
}

export type VectorAppearance =
  | VectorAppearanceStroke
  | VectorAppearanceFill
  | VectorAppearanceExternal

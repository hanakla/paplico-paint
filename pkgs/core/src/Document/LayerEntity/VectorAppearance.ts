import { VectorStrokeSetting } from './VectorStrokeSetting'
import { VectorFillSetting } from './VectorFillSetting'
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

export type VectorAppearance = VectorAppearanceStroke | VectorAppearanceFill

import { VectorStrokeSetting } from './VectorStrokeSetting'
import { VectorFillSetting } from './VectorFillSetting'

export type VectorAppearanceStroke = {
  kind: 'stroke'
  stroke: VectorStrokeSetting
}

export type VectorAppearanceFill = {
  kind: 'fill'
  fill: VectorFillSetting
}

export type VectorAppearance = VectorAppearanceStroke | VectorAppearanceFill

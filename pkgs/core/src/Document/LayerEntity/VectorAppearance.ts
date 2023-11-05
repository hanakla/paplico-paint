import { VectorBrushSetting } from './VectorBrushSetting'
import { FillSetting } from './VectorFillSetting'
import { VectorExternalAppearanceSetting } from './VectorExternalAppearanceSetting'
import { InkSetting } from './InkSetting'

export type VectorAppearanceStroke = {
  kind: 'stroke'

  uid: string
  enabled: boolean

  stroke: VectorBrushSetting
  ink: InkSetting
}

export type VectorAppearanceFill = {
  kind: 'fill'

  uid: string
  enabled: boolean

  fill: FillSetting
}

export type VectorAppearanceExternal = {
  kind: 'external'

  uid: string
  enabled: boolean

  processor: VectorExternalAppearanceSetting<any>
}

export type VectorAppearance =
  | VectorAppearanceStroke
  | VectorAppearanceFill
  | VectorAppearanceExternal

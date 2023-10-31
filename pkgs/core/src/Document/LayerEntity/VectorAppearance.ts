import { VectorStrokeSetting } from './VectorStrokeSetting'
import { VectorFillSetting } from './VectorFillSetting'
import { VectorExternalAppearanceSetting } from './VectorExternalAppearanceSetting'
import { InkSetting } from './InkSetting'

export type VectorAppearanceStroke = {
  kind: 'stroke'

  uid: string
  enabled: boolean

  stroke: VectorStrokeSetting
  ink: InkSetting
}

export type VectorAppearanceFill = {
  kind: 'fill'

  uid: string
  enabled: boolean

  fill: VectorFillSetting
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

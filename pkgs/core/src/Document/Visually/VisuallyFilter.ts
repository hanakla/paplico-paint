import { FillSetting } from '../LayerEntity/VectorFillSetting'
import { ExternalFilterSetting } from './Settings/ExternalFilterSetting'
import { InkSetting } from './Settings/InkFilterSetting'
import { BrushSetting } from './Settings/StrokeSetting'
import * as FilterStructs from './_FilterStructs'

type FilterBase = {
  uid: string
  enabled: boolean
}

export namespace VisuFilter {
  export type StrokeFilter<T extends Record<string, any> | null = null> =
    FilterBase & {
      kind: 'stroke'
      stroke: BrushSetting<T>
      ink: InkSetting
    }

  export type FillFilter = FilterBase & {
    kind: 'fill'
    fill: FillSetting
  }

  export type ExternalFilter<T extends Record<string, any>> = FilterBase & {
    kind: 'external'
    processor: ExternalFilterSetting<T>
  }

  export type AnyFilter = StrokeFilter | FillFilter | ExternalFilter<any>

  export type AnyFilterMapType = {
    stroke: StrokeFilter
    fill: FillFilter
    external: ExternalFilter<any>
  }

  export namespace Structs {
    export type ExternalFilterSetting<T extends Record<string, any>> =
      FilterStructs.ExternalFilterSetting<T>

    export type FillSetting = FilterStructs.FillSetting
    export type InkSetting = FilterStructs.InkSetting
    export type BrushSetting = FilterStructs.BrushSetting
  }
}

import { InkSetting } from './Settings/InkFilterSetting'
import * as FilterStructs from './_FilterStructs'

type FilterBase = {
  uid: string
  enabled: boolean
}

export namespace VisuFilter {
  export type StrokeFilter<T extends Record<string, any> = {}> = FilterBase & {
    kind: 'stroke'
    stroke: FilterStructs.BrushSetting<T>
    ink: InkSetting
  }

  export type FillFilter = FilterBase & {
    kind: 'fill'
    fill: FilterStructs.FillSetting
  }

  export type ExternalFilter<T extends Record<string, any> = {}> =
    FilterBase & {
      kind: 'external'
      processor: FilterStructs.ExternalFilterSetting<T>
    }

  export type AnyFilter = StrokeFilter | FillFilter | ExternalFilter<any>

  export type AnyFilterMapType = {
    stroke: StrokeFilter
    fill: FillFilter
    external: ExternalFilter<any>
  }

  export namespace Structs {
    export type ExternalFilterSetting<T extends Record<string, any> = {}> =
      FilterStructs.ExternalFilterSetting<T>

    export type FillSetting = FilterStructs.FillSetting
    export type InkSetting<T extends Record<string, any> = {}> =
      FilterStructs.InkSetting<T>
    export type BrushSetting<T extends Record<string, any> = {}> =
      FilterStructs.BrushSetting<T>
  }
}

import { InkSetting } from './Settings/InkFilterSetting'
import * as FilterStructs from './Settings'

export namespace VisuFilter {
  export import Structs = FilterStructs

  type FilterBase = {
    uid: string
    enabled: boolean
  }

  export type StrokeFilter<T extends Record<string, any> = {}> = FilterBase & {
    kind: 'stroke'
    stroke: Structs.BrushSetting<T>
    ink: InkSetting
  }

  export type FillFilter = FilterBase & {
    kind: 'fill'
    fill: Structs.FillSetting
  }

  export type PostProcessFilter<T extends Record<string, any> = {}> =
    FilterBase & {
      kind: 'postprocess'
      processor: Structs.PostProcessSetting<T>
    }

  export type AnyFilter = StrokeFilter | FillFilter | PostProcessFilter<any>

  export type AnyFilterMapType = {
    stroke: StrokeFilter
    fill: FillFilter
    postprocess: PostProcessFilter<any>
  }
}

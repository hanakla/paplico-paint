/// <reference path="./declarations.d.ts" />

import { AtomicResource } from './utils/AtomicResource'

export * as Document from './Document'
export {
  CanvasFactory,
  Pipeline,
  RuntimeDocument,
  createBrush,
  createFilter,
  Brushes,
  PapFilter,
  type BrushClass,
  type BrushContext,
  type IBrush,
  type BrushLayoutData,
} from './Engine/index'
export { type ICommand } from './History/ICommand'
export * as Commands from './History/Commands/index'
export * as Filters from './Filters/index'
export { Paplico as default, Paplico } from './Paplico'
export * as PaneUI from './UI/PaneUI/index'
export { UICanvas, UIStroke, type UIStrokePoint } from './UI/index'
export * as VectorProcess from './VectorProcess'
export * as RasterProcess from './RasterProcess'
export * as StrokingHelper from './StrokingHelper'
export * as PaplicoMath from './Math/index'
export { installGlobally as _installPapDebugGlobaly } from './utils/DebugHelper'
export * as Inks from './Inks/index'
export * as ExtraBrushes from './ExtraBrushes/index'

export const _Dev = {
  AtomicResource,
}

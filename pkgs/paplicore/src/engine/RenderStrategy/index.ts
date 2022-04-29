export type { IRenderStrategy } from './IRenderStrategy'

import { DifferenceRender as _D } from './DifferenceRender'
import { FullRender as _F } from './FullRender'

export namespace RenderStrategies {
  export const DifferenceRender = _D
  export type DifferenceRender = _D

  export const FullRender = _F
  export type FullRender = _F
}

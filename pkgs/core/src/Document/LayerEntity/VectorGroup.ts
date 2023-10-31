import { VectorAppearance } from './VectorAppearance'
import { VectorObject } from './VectorObject'
import { CompositeMode, LayerTransform } from '../LayerEntity'

export type VectorGroup = {
  uid: string
  type: 'vectorGroup'
  visible: boolean
  lock: boolean
  transform: LayerTransform
  compositeMode: CompositeMode

  /** Compositing first to last (last is foreground) */
  filters: VectorAppearance[]

  children: (VectorObject | VectorGroup)[]
}

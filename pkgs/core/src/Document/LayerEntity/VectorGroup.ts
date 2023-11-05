import { VectorAppearance } from './VectorAppearance'
import { VectorObject } from './VectorObject'
import { BlendMode, LayerTransform } from '../LayerEntity'

export type VectorGroup = {
  uid: string
  type: 'vectorGroup'

  visible: boolean
  lock: boolean
  opacity: number

  transform: LayerTransform
  blendMode: BlendMode

  /** Compositing first to last (last is foreground) */
  filters: VectorAppearance[]

  children: (VectorObject | VectorGroup)[]
}

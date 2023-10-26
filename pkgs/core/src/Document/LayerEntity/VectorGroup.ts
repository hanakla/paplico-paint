import { VectorAppearance } from './VectorAppearance'
import { VectorStrokeSetting } from './VectorStrokeSetting'
import { VectorFillSetting } from './VectorFillSetting'
import { VectorObject } from './VectorObject'
import { LayerTransform } from '../LayerEntity'

export type VectorGroup = {
  uid: string
  type: 'vectorGroup'
  visible: boolean
  lock: boolean
  transform: LayerTransform

  /** Compositing first to last (last is foreground) */
  appearances: VectorAppearance[]

  children: (VectorObject | VectorGroup)[]
}

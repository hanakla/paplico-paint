import { VectorAppearance } from './VectorAppearance'
import { VectorPath } from './VectorPath'
import { Point2D } from '../Struct/Point2D'
import { LayerTransform } from '../LayerEntity'

export type VectorObject = {
  uid: string
  type: 'vectorObject'
  name: string

  visible: boolean
  lock: boolean
  opacity: number
  transform: LayerTransform

  /** Compositing first to last (last is foreground) */
  filters: VectorAppearance[]

  path: VectorPath
}

import { VectorAppearance } from './VectorAppearance'
import { VectorPath } from './VectorPath'
import { Point2D } from '../Struct/Point2D'
import { BlendMode, LayerTransform } from '../LayerEntity'

export type VectorObject = {
  uid: string
  type: 'vectorObject'
  name: string

  visible: boolean
  lock: boolean
  opacity: number
  transform: LayerTransform

  groupClipper: boolean

  /** Compositing first to last (last is foreground) */
  filters: VectorAppearance[]
  blendMode: BlendMode

  path: VectorPath
}

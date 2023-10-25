import { VectorAppearance } from './VectorAppearance'
import { VectorPath } from './VectorPath'
import { Point2D } from '../Struct/Point2D'

export type VectorObject = {
  uid: string
  type: 'vectorObject'
  name: string

  position: Point2D
  scale: Point2D
  rotate: number

  visible: boolean
  lock: boolean
  opacity: number

  /** Compositing first to last (last is foreground) */
  filters: VectorAppearance[]

  path: VectorPath
}

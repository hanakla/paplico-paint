import { VectorAppearance } from './VectorAppearance'
import { VectorStrokeSetting } from './VectorStrokeSetting'
import { VectorFillSetting } from './VectorFillSetting'
import { VectorObject } from './VectorObject'

export type VectorGroup = {
  uid: string
  type: 'vectorGroup'

  x: number
  y: number
  rotate: number
  scale: [number, number]

  visible: boolean
  lock: boolean

  /** Compositing first to last (last is foreground) */
  appearances: VectorAppearance[]

  children: (VectorObject | VectorGroup)[]
}

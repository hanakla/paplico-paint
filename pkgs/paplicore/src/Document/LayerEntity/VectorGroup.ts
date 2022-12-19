import { BrushSetting, FillSetting } from '../../Value'
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

  brush: BrushSetting | null
  fill: FillSetting | null

  children: (VectorObject | VectorGroup)[]
}

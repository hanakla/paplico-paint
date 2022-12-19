import { FillSetting } from '../../Value'
import { VectorBrushSetting } from './VectorBrushSetting'
import { VectorPath } from './VectorPath'

export type VectorObject = {
  uid: string
  type: 'vectorObject'

  x: number
  y: number
  rotate: number
  scale: [number, number]

  visible: boolean
  lock: boolean

  brush: VectorBrushSetting | null
  fill: FillSetting | null

  path: VectorPath
}

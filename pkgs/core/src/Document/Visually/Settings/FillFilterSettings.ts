import { ColorRGB } from '../../Structs/ColorRGB'
import { ColorStop1D } from '../../Structs/ColorStop1D'

export type FillSetting =
  | {
      type: 'fill'
      color: ColorRGB
      /** 0 to 1 */
      opacity: number
    }
  | {
      type: 'linear-gradient'
      colorStops: ColorStop1D[]
      /** 0 to 1 */
      opacity: number
      /** from center of bounding rect of current object */
      start: { x: number; y: number }
      /** from center of bounding rect of current object */
      end: { x: number; y: number }
    }

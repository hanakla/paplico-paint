import { ColorRGB } from '../../Structs/ColorRGB'

export type BrushSetting<T extends Record<string, any> = Record<string, any>> =
  {
    brushId: string
    brushVersion: string

    /** Should be px */
    size: number

    color: ColorRGB

    /** 0 to 1 */
    opacity: number

    /** Brush renderer specific settings */
    settings: T
  }

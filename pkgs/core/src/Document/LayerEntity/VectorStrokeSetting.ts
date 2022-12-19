import { ColorRGB } from '../Struct/ColorRGB'

export type VectorStrokeSetting<T extends Record<string, any> | null = null> = {
  brushId: string
  brushVersion: string

  /** Should be px */
  size: number

  color: ColorRGB

  /** 0 to 1 */
  opacity: number

  /** Brush renderer specific settings */
  specific: T
}

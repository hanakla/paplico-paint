import { ColorRGBA } from '../Struct/ColorRGBA'
import { Point2D } from '../Struct/Point2D'

export type TextNode = {
  text: string
  fontFamily?: string
  fontStyle?: string
  fontSize?: number
  position: Point2D
  color?: ColorRGBA
}

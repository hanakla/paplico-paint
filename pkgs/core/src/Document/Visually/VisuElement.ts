import { TypenGlossary } from '@/TypesAndGlossary'
import { Point2D } from '../Struct/Point2D'
import { ColorRGBA } from '../Struct/ColorRGBA'
import { VisuFilter } from './VisuallyFilter'

/** Paplico internal use only */
export type ElementBase = {
  uid: string
  name: string
  visible: boolean
  lock: boolean
  blendMode: VisuElement.BlendMode

  /** 0 to 1 */
  opacity: number

  transform: VisuElement.ElementTransform
  filters: VisuFilter.AnyFilter[]
  clipByLowerLayer: boolean

  features: { [featureName: string]: Record<string, any> }
}

export namespace VisuElement {
  export type BlendMode = TypenGlossary.BlendMode
  export type CompositeMode = TypenGlossary.StrokeCompositeMode

  export type ElementTransform = {
    position: Point2D
    scale: Point2D
    rotate: number
  }

  export type FilterElement = ElementBase & {
    type: 'filter'
  }

  export type GroupElement = ElementBase & {
    type: 'group'
    // really childrens manged by layer node
  }

  // export type ClipGroupElement = ElementBase & {
  //   type: 'clipGroup'
  // }

  export type CanvasElement = ElementBase & {
    type: 'canvas'
    width: number
    height: number
    bitmap: Uint8ClampedArray
    colorSpace: PredefinedColorSpace
  }

  export type ImageReferenceElement = ElementBase & {
    type: 'reference'
    referenceNodePath: string[] | null
  }

  export type TextElement = ElementBase & {
    type: 'text'
    fontFamily: string
    fontStyle: string
    fontSize: number
    textNodes: TextNode[]
  }

  export type VectorObjectElement = ElementBase & {
    type: 'vectorObject'
    clipCotainerGroup: boolean
    path: VectorPath
  }

  export type AnyElement =
    | VisuElement.FilterElement
    | VisuElement.GroupElement
    | VisuElement.CanvasElement
    | VisuElement.ImageReferenceElement
    | VisuElement.TextElement
    | VisuElement.VectorObjectElement

  export type TextNode = {
    text: string
    fontFamily?: string
    fontStyle?: string
    fontSize?: number
    position: Point2D
    color?: ColorRGBA
  }

  export type VectorPath = {
    points: VectorPathPoint[]

    /** reserved, must be po asc ordered array */
    // weightMap: {
    //   /** 0 to 1 */
    //   pos: number
    //   /** 0 to 1 */
    //   pressure: number
    //   /** weight balance, Left: -1 to Right: 1.
    //    * "Left" is Left side of top to bottom draw line. */
    //   balance: number
    // }[]

    /** reserved, must be po asc ordered array */
    // tiltMap: {
    //   /** 0 to 1 */
    //   pos: number
    //   tilt: Point2D
    // }[]

    /** reserved, must be po asc ordered array */
    // deltaTimeMap: {
    //   /** 0 to 1 */
    //   pos: number
    //   /** milliseconds */
    //   deltaTime: number
    // }[]

    /** Should default to nonzero */
    fillRule: 'nonzero' | 'evenodd'
    randomSeed: number
  }

  export type VectorPathPoint =
    | {
        isMoveTo: true
        isClose?: false
        x: number
        y: number
      }
    | {
        isMoveTo?: false
        isClose: true
      }
    | {
        /** if it undefined, this point not should be moveto */
        isMoveTo?: false

        /**
         * if it undefined, this point not should be Z.
         * if it true, Ignore another attributes (x, y will ignored)
         */
        isClose?: false

        // SEE: https://svgwg.org/svg2-draft/paths.html#PathDataCubicBezierCommands
        /** Absolute position(x1, y1), control point for beginning of curve */
        begin?: { x: number; y: number } | null
        /** Absolute position(x2, y2), control point for end of curve */
        end?: { x: number; y: number } | null

        /** Absolute position on canvas */
        x: number

        /** Absolute position on canvas */
        y: number

        /** 0 to 1 defaults to should be 1 */
        pressure?: number | null

        /** milliseconds to this point from previous point */
        deltaTime?: number | null

        tilt?: { x: number; y: number } | null
      }

  // export type VectorPathPoint = {
  //   // SEE: https://svgwg.org/svg2-draft/paths.html#PathDataCubicBezierCommands
  //   /** Absolute position(x1, y1), control point for beginning of curve */
  //   begin?: { x: number; y: number } | null
  //   /** Absolute position(x2, y2), control point for end of curve */
  //   end?: { x: number; y: number } | null

  //   /** Absolute position on canvas */
  //   x: number

  //   /** Absolute position on canvas */
  //   y: number

  //   /** 0 to 1 defaults to should be 1 */
  //   pressure?: number | null

  //   /** milliseconds to this point from previous point */
  //   deltaTime?: number | null

  //   tilt?: { x: number; y: number } | null

  //   /** if it undefined, this point not should be moveto */
  //   isMoveTo?: boolean

  //   /**
  //    * if it undefined, this point not should be Z
  //    * Ignore another attributes
  //    */
  //   isClose?: boolean
  // }
}

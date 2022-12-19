import type { LayerFilter } from './LayerFilter'
import type { VectorObject } from './LayerEntity/VectorObject'
import type { VectorGroup } from './LayerEntity/VectorGroup'
import { Point2D } from './Struct/Point2D'

export type CompositeMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'clipper'

export type LayerEntityBase = {
  uid: string
  name: string
  visible: boolean
  lock: boolean
  compositeMode: CompositeMode

  /** 0 to 1 */
  opacity: number

  features: { [featureName: string]: Record<string, any> }
}

type Transform = {
  position: Point2D
  scale: Point2D
  rotate: number
}

// layerType: 'raster' | 'vector' | 'filter' | 'group' | 'text' | 'reference'

// export type LayerEntity =  | FilterLayer

export type FilterLayer = LayerEntityBase & {
  layerType: 'filter'
  filters: LayerFilter[]
}

export type RasterLayer = LayerEntityBase & {
  layerType: 'raster'
  width: number
  height: number
  transform: Transform
  bitmap: Uint8ClampedArray
}

export type VectorLayer = LayerEntityBase & {
  layerType: 'vector'
  transform: Transform

  /** Compositing first to last (last is foreground) */
  objects: (VectorObject | VectorGroup)[]
}

export type ReferenceLayer = LayerEntityBase & {
  layerType: 'reference'
  referencedLayerId: string
  transform: Transform
}

export type GroupLayer = LayerEntityBase & {
  layerType: 'group'
  transform: Transform
}

export type TextLayer = LayerEntityBase & {
  layerType: 'group'
  // TODO
}

export type ArtboradLayer = LayerEntityBase & {
  layerType: 'artboard'
}

export type LayerEntity =
  | FilterLayer
  | RasterLayer
  | VectorLayer
  | ReferenceLayer
  | GroupLayer
  | TextLayer
  | ArtboradLayer

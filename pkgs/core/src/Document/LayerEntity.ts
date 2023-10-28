import type { LayerFilter } from './LayerFilter'
import type { VectorObject } from './LayerEntity/VectorObject'
import type { VectorGroup } from './LayerEntity/VectorGroup'
import { Point2D } from './Struct/Point2D'
import { TextNode } from './LayerEntity/TextNode'

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
  filters: LayerFilter[]
}

export type LayerTransform = {
  position: Point2D
  scale: Point2D
  rotate: number
}

// layerType: 'raster' | 'vector' | 'filter' | 'group' | 'text' | 'reference'

// export type LayerEntity =  | FilterLayer

export type RootLayer = Omit<LayerEntityBase, 'uid'> & {
  layerType: 'root'
  uid: '__root__'
}

export type FilterLayer = LayerEntityBase & {
  layerType: 'filter'
}

export type RasterLayer = LayerEntityBase & {
  layerType: 'raster'
  width: number
  height: number
  transform: LayerTransform
  bitmap: Uint8ClampedArray
}

export type VectorLayer = LayerEntityBase & {
  layerType: 'vector'
  transform: LayerTransform

  /** Compositing first to last (last is foreground) */
  objects: (VectorObject | VectorGroup)[]
}

export type ReferenceLayer = LayerEntityBase & {
  layerType: 'reference'
  referencedLayerId: string
  transform: LayerTransform
}

export type GroupLayer = LayerEntityBase & {
  layerType: 'group'
  transform: LayerTransform
}

export type TextLayer = LayerEntityBase & {
  layerType: 'text'
  transform: LayerTransform
  fontFamily: string
  fontStyle?: string
  fontSize: number
  textNodes: TextNode[]
}

export type ArtboradLayer = LayerEntityBase & {
  layerType: 'artboard'
}

export type LayerEntity =
  | RootLayer
  | FilterLayer
  | RasterLayer
  | VectorLayer
  | ReferenceLayer
  | GroupLayer
  | TextLayer
  | ArtboradLayer

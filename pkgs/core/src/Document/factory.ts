import prand from 'pure-rand'

import { ulid } from '@/utils/ulid'
import { PaplicoDocument } from './Document'
import { FilterLayer, RasterLayer, TextLayer, VectorLayer } from './LayerEntity'
import { VectorObject } from './LayerEntity/VectorObject'
import { TypeStrictVectorPathPoint, VectorPath } from './LayerEntity/VectorPath'
import { LayerFilter } from './LayerFilter'
import {
  VectorAppearance,
  VectorAppearanceExternal,
  VectorAppearanceFill,
  VectorAppearanceStroke,
} from './LayerEntity/VectorAppearance'

type Requires<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: T[P]
}

const DEFAULT_TRANSFORM = () => ({
  position: { x: 0, y: 0 },
  rotate: 0,
  scale: { x: 1, y: 1 },
})

export const createDocument = ({
  width,
  height,
}: {
  width: number
  height: number
}) => {
  return new PaplicoDocument({ width, height })
}

export const createRasterLayerEntity = ({
  name = '',
  width,
  height,
  lock = false,
  opacity = 1,
  visible = true,
  compositeMode = 'normal',
  transform = DEFAULT_TRANSFORM(),
  filters = [],
  features = {},
}: Requires<
  Partial<Omit<RasterLayer, 'uid' | 'layerType'>>,
  'width' | 'height'
>): RasterLayer => ({
  uid: `raster-${ulid()}`,
  layerType: 'raster',
  name,
  width,
  height,
  compositeMode,
  lock,
  opacity,
  visible,
  transform,
  features,
  filters,
  bitmap: new Uint8ClampedArray(width * height * 4),
})

export const createVectorLayerEntity = ({
  name = '',
  lock = false,
  opacity = 1,
  visible = true,
  compositeMode = 'normal',
  transform = DEFAULT_TRANSFORM(),
  filters = [],
  features = {},
  objects = [],
}: Partial<Omit<VectorLayer, 'uid' | 'layerType'>>): VectorLayer => ({
  uid: `vector-${ulid()}`,
  layerType: 'vector',
  name,
  compositeMode,
  lock,
  opacity,
  visible,
  transform,
  features,
  filters,
  objects,
})

export const createVectorObject = ({
  name = '',
  lock = false,
  visible = true,
  transform = DEFAULT_TRANSFORM(),
  opacity = 1,
  filters = [],
  path = createVectorPath({}),
}: Requires<
  Partial<Omit<VectorObject, 'uid' | 'type'>>,
  'path'
>): VectorObject => ({
  uid: `vectorObject-${ulid()}`,
  type: 'vectorObject',
  name,
  lock,
  visible,
  transform,
  opacity,
  filters,
  path,
})

export const createVectorPath = ({
  randomSeed = prand.mersenne(Math.random()).next()[0],
  fillRule = 'nonzero',
  points = [],
}: Partial<Omit<VectorPath, 'points'>> & {
  points?: TypeStrictVectorPathPoint[]
}): VectorPath => ({
  points,
  fillRule,
  randomSeed,
})

export const createVectorAppearance = ({
  kind,
  ...etc
}:
  | Requires<Partial<Omit<VectorAppearanceFill, 'uid'>>, 'kind' | 'fill'>
  | Requires<
      Partial<Omit<VectorAppearanceStroke, 'uid'>>,
      'kind' | 'stroke' | 'ink'
    >
  | Requires<
      Partial<Omit<VectorAppearanceExternal, 'uid'>>,
      'kind' | 'processor'
    >): VectorAppearance =>
  ({
    uid: `vectorAppearance-${ulid()}`,
    kind,
    ...etc,
  }) as VectorAppearance

export const createFilterLayerEntity = ({
  name = '',
  lock = false,
  visible = true,
  opacity = 1,
  compositeMode = 'normal',
  features = {},
  filters = [],
}: Requires<
  Partial<Omit<FilterLayer, 'uid' | 'layerType'>>,
  'filters'
>): FilterLayer => ({
  uid: `filter-${ulid()}`,
  layerType: 'filter',
  name,
  lock,
  visible,
  opacity,
  compositeMode,
  features,
  filters,
})

export const createFilterEntry = ({
  filterId,
  filterVersion,
  settings,
  enabled = true,
  opacity = 1,
}: Requires<
  Partial<Omit<LayerFilter, 'uid'>>,
  'filterId' | 'filterVersion' | 'settings'
>): LayerFilter => ({
  uid: `layerFilter-${ulid()}`,
  filterId,
  filterVersion,
  settings,
  enabled,
  opacity,
})

export const createTextLayerEntity = ({
  name = '',
  lock = false,
  visible = true,
  transform = DEFAULT_TRANSFORM(),
  opacity = 1,
  compositeMode = 'normal',
  fontFamily = 'sans-serif',
  fontSize = 16,
  fontStyle = 'normal',
  textNodes = [],
  features = {},
  filters = [],
}: Partial<Omit<TextLayer, 'uid' | 'layerType'>>): TextLayer => ({
  uid: `text-${ulid()}`,
  layerType: 'text',
  name,
  lock,
  visible,
  transform,
  opacity,
  compositeMode,
  features,
  filters,
  fontFamily,
  fontStyle,
  fontSize,
  textNodes,
})

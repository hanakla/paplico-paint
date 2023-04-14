import prand from 'pure-rand'

import { ulid } from '@/utils/ulid'
import { PaplicoDocument } from './Document'
import { FilterLayer, RasterLayer, VectorLayer } from './LayerEntity'
import { VectorObject } from './LayerEntity/VectorObject'
import { VectorPath } from './LayerEntity/VectorPath'

type Requires<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: T[P]
}

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
  transform = {
    position: { x: 0, y: 0 },
    rotate: 0,
    scale: { x: 1, y: 1 },
  },

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
  bitmap: new Uint8ClampedArray(width * height * 4),
})

export const createVectorLayerEntity = ({
  name = '',
  lock = false,
  opacity = 1,
  visible = true,
  compositeMode = 'normal',
  transform = {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotate: 0,
  },
  features = {},
}: Partial<
  Omit<VectorLayer, 'uid' | 'layerType' | 'objects'>
>): VectorLayer => ({
  uid: `vector-${ulid()}`,
  layerType: 'vector',
  name,
  compositeMode,
  lock,
  opacity,
  visible,
  transform,
  features,
  objects: [],
})

export const createVectorObject = ({
  name = '',
  lock = false,
  visible = true,
  position = { x: 0, y: 0 },
  scale = { x: 1, y: 1 },
  rotate = 0,
  opacity = 1,
  appearances = [],
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
  position,
  scale,
  rotate,
  opacity,
  appearances,
  path,
})

export const createVectorPath = ({
  closed = false,
  randomSeed = prand.mersenne(Math.random()).next()[0],
  points = [],
}: Partial<VectorPath>): VectorPath => ({
  points,
  closed,
  randomSeed,
})

export const createFilterLayerEntity = ({
  name = '',
  lock = false,
  visible = true,
  opacity = 1,
  compositeMode = 'normal',
  features = {},
  filters,
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

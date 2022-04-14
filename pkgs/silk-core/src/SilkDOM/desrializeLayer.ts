import { FilterLayer } from './FilterLayer'
import { GroupLayer } from './GroupLayer'
import { LayerTypes } from './index'
import { RasterLayer } from './RasterLayer'
import { ReferenceLayer } from './ReferenceLayer'
import { TextLayer } from './TextLayer'
import { VectorLayer } from './VectorLayer'

export const deserializeLayer = (layer: any) => {
  switch (layer.layerType as LayerTypes['layerType']) {
    case 'raster':
      return RasterLayer.deserialize(layer)
    case 'vector':
      return VectorLayer.deserialize(layer)
    case 'filter':
      return FilterLayer.deserialize(layer)
    case 'text':
      return TextLayer.deserialize(layer)
    case 'group':
      return GroupLayer.deserialize(layer)
    case 'reference':
      return ReferenceLayer.deserialize(layer)
    default:
      throw new Error(
        `Deserialization failed, unexpected layerType ${layer.layerType}`
      )
  }
}

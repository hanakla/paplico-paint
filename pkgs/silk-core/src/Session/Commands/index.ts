import { DocumentAddLayer } from './DocumentAddLayer'

import { LayerPatchLayerAttr } from './LayerPatchLayerAttr'
import { VectorAddObject } from './VectorAddObject'

export const Commands = {
  Document: { AddLayer: DocumentAddLayer },
  Layer: { PatchLayerAttr: LayerPatchLayerAttr },
  VectorLayer: { AddObject: VectorAddObject },
}

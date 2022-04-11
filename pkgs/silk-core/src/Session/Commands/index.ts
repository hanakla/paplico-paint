import { ICommand } from '../ICommand'
import { DocumentAddLayer } from './DocumentAddLayer'

import { LayerPatchLayerAttr } from './LayerPatchLayerAttr'
import { VectorAddObject } from './VectorAddObject'
import { VectorObjectPatchAttr } from './VectorObjectPatchAttr'
import { VectorObjectTransform } from './VectorObjectTransform'
import { VectorObjectRemovePoint } from './VectorObjectRemovePoint'

export declare namespace Commands {
  type AnyCommandType = ICommand
}

export const Commands = {
  Document: { AddLayer: DocumentAddLayer },
  Layer: { PatchLayerAttr: LayerPatchLayerAttr },
  VectorLayer: {
    AddObject: VectorAddObject,
    PatchObjectAttr: VectorObjectPatchAttr,
    TransformObject: VectorObjectTransform,
    RemovePathPoint: VectorObjectRemovePoint,
  },
}

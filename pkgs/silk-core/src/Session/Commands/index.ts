import { ICommand } from '../ICommand'
import { DocumentAddLayer } from './DocumentAddLayer'

import { LayerPatchLayerAttr } from './LayerPatchLayerAttr'
import { VectorAddObject } from './VectorAddObject'
import { VectorObjectPatchAttr } from './VectorObjectPatchAttr'
import { VectorObjectTransform } from './VectorObjectTransform'
import { VectorObjectRemovePoint } from './VectorObjectRemovePoint'
import { Transaction } from './Transaction'
import { VectorObjectPatchPathPoints } from './VectorObjectPatchPathPoints'
import { LayerConvertToGroup } from './LayerConvertToGroup'

export const Commands = {
  Transaction: Transaction,
  Document: { AddLayer: DocumentAddLayer },
  Layer: {
    PatchLayerAttr: LayerPatchLayerAttr,
    ConvertToGroup: LayerConvertToGroup,
  },
  VectorLayer: {
    AddObject: VectorAddObject,
    PatchObjectAttr: VectorObjectPatchAttr,
    PatchPathPoints: VectorObjectPatchPathPoints,
    TransformObject: VectorObjectTransform,
    RemovePathPoint: VectorObjectRemovePoint,
  },
}

export declare namespace Commands {
  type AnyCommandType = ICommand

  export type Transaction = InstanceType<typeof Commands.Transaction>
  export type Document = typeof Commands.Document
  export type Layer = typeof Commands.Layer
  export type VectorLayer = typeof Commands.VectorLayer
}

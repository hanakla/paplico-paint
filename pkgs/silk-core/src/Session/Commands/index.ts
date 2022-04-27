import { ICommand } from '../ICommand'
import { DocumentAddLayer } from './DocumentAddLayer'

import { LayerConvertToGroup } from './LayerConvertToGroup'
import { LayerDelete } from './LayerDelete'
import { LayerMoveLayer } from './LayerMoveLayer'
import { LayerPatchLayerAttr } from './LayerPatchLayerAttr'
import { RasterUpdateBitmap } from './RasterUpdateBitmap'
import { VectorAddObject } from './VectorAddObject'
import { VectorObjectPatchAttr } from './VectorObjectPatchAttr'
import { VectorObjectTransform } from './VectorObjectTransform'
import { VectorObjectRemovePoint } from './VectorObjectRemovePoint'
import { Transaction } from './Transaction'
import { VectorObjectPatchPathAttr } from './VectorObjectPatchPathAttr'
import { VectorObjectPatchPathPoints } from './VectorObjectPatchPathPoints'
import { VectorDeleteObject } from './VectorDeleteObject'
import { VectorObjectReorder } from './VectorObjectReorder'

export const Commands = {
  Transaction: Transaction,
  Document: { AddLayer: DocumentAddLayer },
  Layer: {
    PatchLayerAttr: LayerPatchLayerAttr,
    ConvertToGroup: LayerConvertToGroup,
    DeleteLayer: LayerDelete,
    MoveLayer: LayerMoveLayer,
  },
  RasterLayer: {
    UpdateBitmap: RasterUpdateBitmap,
  },
  VectorLayer: {
    AddObject: VectorAddObject,
    DeleteObject: VectorDeleteObject,
    PatchObjectAttr: VectorObjectPatchAttr,
    PatchPathAttr: VectorObjectPatchPathAttr,
    PatchPathPoints: VectorObjectPatchPathPoints,
    TransformObject: VectorObjectTransform,
    RemovePathPoint: VectorObjectRemovePoint,
    ReorderObjects: VectorObjectReorder,
  },
}

export declare namespace Commands {
  type AnyCommandType = ICommand

  export type Transaction = InstanceType<typeof Commands.Transaction>
  export type Document = typeof Commands.Document
  export type Layer = typeof Commands.Layer
  export type VectorLayer = typeof Commands.VectorLayer
}

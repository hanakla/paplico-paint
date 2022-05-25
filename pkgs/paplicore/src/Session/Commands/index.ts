import { ICommand } from '../ICommand'
import { DocumentAddLayer } from './DocumentAddLayer'

import { FilterPatchAttr } from './FilterPatchAttr'
import { LayerConvertToGroup } from './LayerConvertToGroup'
import { LayerDelete } from './LayerDelete'
import { LayerAddFilter } from './LayerAddFilter'
import { LayerDuplicate } from './LayerDuplicate'
import { LayerRemoveFilter } from './LayerRemoveFilter'
import { LayerMoveLayer } from './LayerMoveLayer'
import { LayerPatchLayerAttr } from './LayerPatchLayerAttr'
import { LayerFilterReorder } from './LayerFilterReorder'
import { RasterUpdateBitmap } from './RasterUpdateBitmap'
import { RasterTrimToDocumentArea } from './RasterTrimToDocumentArea'
import { VectorAddObject } from './VectorAddObject'
import { VectorObjectPatchAttr } from './VectorObjectPatchAttr'
import { VectorObjectTransform } from './VectorObjectTransform'
import { Transaction } from './Transaction'
import { VectorObjectPatchPathAttr } from './VectorObjectPatchPathAttr'
import { VectorObjectPatchPathPoints } from './VectorObjectPatchPathPoints'
import { VectorDeleteObject } from './VectorDeleteObject'
import { VectorObjectReorder } from './VectorObjectReorder'

export const Commands = {
  Transaction: Transaction,
  Document: { AddLayer: DocumentAddLayer },
  Filter: { PatchAttr: FilterPatchAttr },
  Layer: {
    AddFilter: LayerAddFilter,
    RemoveFilter: LayerRemoveFilter,
    PatchLayerAttr: LayerPatchLayerAttr,
    ConvertToGroup: LayerConvertToGroup,
    DeleteLayer: LayerDelete,
    DuplicateLayer: LayerDuplicate,
    MoveLayer: LayerMoveLayer,
    ReorderFilter: LayerFilterReorder,
  },
  RasterLayer: {
    UpdateBitmap: RasterUpdateBitmap,
    TrimToDocumentArea: RasterTrimToDocumentArea,
  },
  VectorLayer: {
    AddObject: VectorAddObject,
    DeleteObject: VectorDeleteObject,
    PatchObjectAttr: VectorObjectPatchAttr,
    PatchPathAttr: VectorObjectPatchPathAttr,
    PatchPathPoints: VectorObjectPatchPathPoints,
    TransformObject: VectorObjectTransform,
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

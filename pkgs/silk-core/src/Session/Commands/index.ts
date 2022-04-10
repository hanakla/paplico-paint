import { ICommand } from '../ICommand'
import { DocumentAddLayer } from './DocumentAddLayer'

import { LayerPatchLayerAttr } from './LayerPatchLayerAttr'
import { VectorAddObject } from './VectorAddObject'
import { VectorObjectTransform } from './VectorObjectTransform'

export declare namespace Commands {
  type AnyCommandType = ICommand
}

export const Commands = {
  Document: { AddLayer: DocumentAddLayer },
  Layer: { PatchLayerAttr: LayerPatchLayerAttr },
  VectorLayer: {
    AddObject: VectorAddObject,
    TransformObject: VectorObjectTransform,
  },
}

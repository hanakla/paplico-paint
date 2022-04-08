import { DocumentDigger } from '../../DocumentDigger'
import { ICommand } from '../ICommand'
import { LayerProperties } from '../../SilkDOM/IRenderable'
import { Document } from '../../SilkDOM'
import { assign, pick } from '../../utils'

export class LayerPatchLayerAttr implements ICommand {
  private patch: Partial<LayerProperties> = {}
  private revertPatch: Partial<LayerProperties> = {}
  private pathToTargetLayer: string[]

  constructor({
    patch,
    pathToTargetLayer,
  }: {
    patch: LayerProperties
    pathToTargetLayer: string[]
  }) {
    this.patch = patch
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    const layer = DocumentDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
    })!

    this.revertPatch = pick(
      layer as LayerProperties,
      Object.keys(this.patch) as any
    )

    layer.update((l) => assign(l, this.patch))
  }

  async undo(document: Document): Promise<void> {
    DocumentDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
    })!.update((l) => assign(l, this.revertPatch))
  }

  async redo(document: Document): Promise<void> {
    DocumentDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
    })!.update((l) => assign(l, this.patch))
  }
}

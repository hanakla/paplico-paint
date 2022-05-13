import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { ILayer } from '../../DOM/ILayer'
import { Document } from '../../DOM'
import { assign, pick } from '../../utils/object'

export class LayerPatchLayerAttr implements ICommand {
  public readonly name = 'LayerPatchLayerAttr'

  private patch: Partial<ILayer.Attributes> = {}
  private revertPatch: Partial<ILayer.Attributes> = {}
  private pathToTargetLayer: string[]

  constructor({
    patch,
    pathToTargetLayer,
  }: {
    patch: Partial<ILayer.Attributes>
    pathToTargetLayer: string[]
  }) {
    this.patch = patch
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    this.revertPatch = pick(
      layer as ILayer.Attributes,
      Object.keys(this.patch) as any
    )

    layer.update((l) => assign(l, this.patch))
  }

  async undo(document: Document): Promise<void> {
    PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })!.update((l) => assign(l, this.revertPatch))
  }

  async redo(document: Document): Promise<void> {
    PapDOMDigger.findLayer(document, this.pathToTargetLayer, {})!.update((l) =>
      assign(l, this.patch)
    )
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

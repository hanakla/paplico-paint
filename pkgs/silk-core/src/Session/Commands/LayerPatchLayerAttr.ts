import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { LayerProperties } from '../../SilkDOM/ILayer'
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
    patch: Partial<LayerProperties>
    pathToTargetLayer: string[]
  }) {
    this.patch = patch
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    this.revertPatch = pick(
      layer as LayerProperties,
      Object.keys(this.patch) as any
    )

    layer.update((l) => assign(l, this.patch))
  }

  async undo(document: Document): Promise<void> {
    SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
    })!.update((l) => assign(l, this.revertPatch))
  }

  async redo(document: Document): Promise<void> {
    SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
    })!.update((l) => assign(l, this.patch))
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

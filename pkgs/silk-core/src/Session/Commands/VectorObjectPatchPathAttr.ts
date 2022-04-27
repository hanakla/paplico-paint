import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { Document, Path } from '../../SilkDOM'
import { assign, pick } from '../../utils'

export class VectorObjectPatchPathAttr implements ICommand {
  public readonly name = 'VectorObjectPatchPathAttr'

  private patch: Partial<Path.Attributes> = {}
  private pathToTargetLayer: string[]
  private targetObjectUid: string

  private revertPatch: Partial<Path.Attributes> = {}

  constructor({
    patch,
    pathToTargetLayer,
    objectUid,
  }: {
    patch: Partial<Path.Attributes>
    pathToTargetLayer: string[]
    objectUid: string
  }) {
    this.patch = patch
    this.pathToTargetLayer = pathToTargetLayer
    this.targetObjectUid = objectUid
  }

  async do(document: Document) {
    const object = SilkDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )

    this.revertPatch = pick(
      object.path as Path.Attributes,
      Object.keys(this.patch) as any
    )

    object.path.update((p) => assign(p, this.patch))
  }

  async undo(document: Document): Promise<void> {
    SilkDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )!.path.update((l) => assign(l, this.revertPatch))
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

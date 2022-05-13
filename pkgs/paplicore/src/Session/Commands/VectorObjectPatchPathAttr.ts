import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, Path } from '../../DOM'
import { assign, pick } from '../../utils/object'

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
    const object = PapDOMDigger.findObjectInLayer(
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

    const nextPath = object.path.clone()
    assign(nextPath, this.patch)
    if (object.path.isFreezed) nextPath.freeze()

    object.update((o) => (o.path = nextPath))
  }

  async undo(document: Document): Promise<void> {
    const object = PapDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )!

    const nextPath = object.path.clone()
    assign(nextPath, this.revertPatch)
    if (object.path.isFreezed) nextPath.freeze()

    object.update((o) => (o.path = nextPath))
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

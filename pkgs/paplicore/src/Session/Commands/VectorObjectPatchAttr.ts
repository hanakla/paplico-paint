import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, VectorObject } from '../../DOM'
import { assign, pick } from '../../utils'

export class VectorObjectPatchAttr implements ICommand {
  public readonly name = 'VectorObjectPatchAttr'

  private patch: Partial<VectorObject.Attributes> = {}
  private pathToTargetLayer: string[]
  private targetObjectUid: string

  private revertPatch: Partial<VectorObject.Attributes> = {}

  constructor({
    patch,
    pathToTargetLayer,
    objectUid,
  }: {
    patch: Partial<VectorObject.Attributes>
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
      object as VectorObject.Attributes,
      Object.keys(this.patch) as any
    )

    object.update((l) => assign(l, this.patch))
  }

  async undo(document: Document): Promise<void> {
    PapDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )!.update((l) => assign(l, this.revertPatch))
  }

  async redo(document: Document): Promise<void> {
    PapDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )!.update((l) => assign(l, this.patch))
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

import * as jsondiff from 'jsondiffpatch'
import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, VectorObject } from '../../DOM'
import { assign, deepClone, pick } from '../../utils/object'

type Patcher = (attr: VectorObject.Attributes) => void

export class VectorObjectPatchAttr implements ICommand {
  public readonly name = 'VectorObjectPatchAttr'

  private patcher: (attrs: VectorObject.PatchableAttributes) => void
  private pathToTargetLayer: string[]
  private targetObjectUid: string

  private jsonDelta!: jsondiff.Delta

  constructor({
    pathToTargetLayer,
    objectUid,
    patcher,
  }: {
    pathToTargetLayer: string[]
    objectUid: string
    patcher: (attrs: VectorObject.PatchableAttributes) => void
  }) {
    this.pathToTargetLayer = pathToTargetLayer
    this.targetObjectUid = objectUid
    this.patcher = patcher
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

    const original = deepClone(pick(object, VectorObject.patchableAttributes))
    const next = deepClone(original)
    this.patcher(next)

    this.jsonDelta = jsondiff.diff(original, next)!
    object.update((obj) => jsondiff.patch(obj, this.jsonDelta))
  }

  async undo(document: Document): Promise<void> {
    const obj = PapDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )

    obj.update((obj) => assign(obj, jsondiff.unpatch(obj, this.jsonDelta)))
  }

  async redo(document: Document): Promise<void> {
    const obj = PapDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )

    obj.update((obj) => jsondiff.patch(obj, this.jsonDelta))
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

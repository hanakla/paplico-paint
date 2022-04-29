import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, VectorObject } from '../../DOM'

export class VectorDeleteObject implements ICommand {
  public readonly name = 'VectorDeleteObject'

  private objectUid: string
  private pathToTargetLayer: string[]

  private object!: VectorObject
  private objectIdx!: number

  constructor({
    objectUid,
    pathToTargetLayer,
  }: {
    objectUid: string
    pathToTargetLayer: string[]
  }) {
    this.objectUid = objectUid
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    })

    this.object = PapDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.objectUid,
      { strict: true }
    )

    this.objectIdx = layer.objects.findIndex((o) => o.uid === this.objectUid)

    layer.update((l) => {
      layer.objects.splice(this.objectIdx, 1)
    })
  }

  async undo(document: Document): Promise<void> {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    })

    layer.update((l) => {
      l.objects.splice(this.objectIdx, 0, this.object)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, VectorObject } from '../../DOM'

export class VectorAddObject implements ICommand {
  public readonly name = 'VectorAddObject'

  private object: VectorObject
  private pathToTargetLayer: string[]

  constructor({
    object,
    pathToTargetLayer,
  }: {
    object: VectorObject
    pathToTargetLayer: string[]
  }) {
    this.object = object
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    }).update((l) => l.objects.unshift(this.object))
  }

  async undo(document: Document): Promise<void> {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    })

    const idx = layer.objects.findIndex((o) => o.uid === this.object.uid)
    if (idx === -1) return

    layer.update((l) => l.objects.splice(idx, 1))
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

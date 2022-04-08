import { DocumentDigger } from 'DocumentDigger'
import { ICommand } from 'Session/ICommand'
import { Document, VectorObject } from '../../SilkDOM'

export class VectorAddObject implements ICommand {
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
    DocumentDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
    })!.objects.push(this.object)
  }

  async undo(document: Document): Promise<void> {
    const layer = DocumentDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
    })!

    const idx = layer.objects.findIndex((o) => o.uid === this.object.uid)
    if (idx === -1) return

    layer.update((l) => l.objects.splice(idx, 1))
  }

  async redo(document: Document): Promise<void> {
    const layer = DocumentDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
    })!.objects.push(this.object)
  }
}

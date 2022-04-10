import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
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
    SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    }).objects.unshift(this.object)
  }

  async undo(document: Document): Promise<void> {
    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    })

    const idx = layer.objects.findIndex((o) => o.uid === this.object.uid)
    if (idx === -1) return

    layer.update((l) => l.objects.splice(idx, 1))
  }

  async redo(document: Document): Promise<void> {
    SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    }).objects.unshift(this.object)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

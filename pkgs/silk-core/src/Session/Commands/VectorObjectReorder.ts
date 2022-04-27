import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { Document } from '../../SilkDOM'

type Ordering = { delta: number } | { exactly: number }

export class VectorObjectReorder implements ICommand {
  public readonly name = 'VectorObjectReorder'

  private pathToTargetLayer: string[]
  private objectUid: string
  private oldIndex: number | null = null
  private newIndex: Ordering

  constructor({
    pathToTargetLayer,
    objectUid,
    newIndex,
  }: {
    pathToTargetLayer: string[]
    objectUid: string
    newIndex: Ordering
  }) {
    this.pathToTargetLayer = pathToTargetLayer
    this.objectUid = objectUid
    this.newIndex = newIndex
  }

  async do(document: Document) {
    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    })

    const result = SilkDOMDigger.findObjectInThisLayer(layer, this.objectUid, {
      strict: true,
    })

    if (result) {
      this.oldIndex = result.index

      layer.update((l) => {
        const nextIndex =
          'delta' in this.newIndex
            ? this.oldIndex! + this.newIndex.delta
            : this.newIndex.exactly

        l.objects.splice(this.oldIndex!, 1)
        l.objects.splice(nextIndex, 0, result.object)
      })
    }
  }

  async undo(document: Document): Promise<void> {
    if (this.oldIndex == null) return

    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    })

    const result = SilkDOMDigger.findObjectInThisLayer(layer, this.objectUid, {
      strict: true,
    })

    if (result) {
      layer.update((l) => {
        const nextIndex =
          'delta' in this.newIndex
            ? this.oldIndex! + -this.newIndex.delta
            : this.oldIndex

        l.objects.splice(result.index, 1)
        l.objects.splice(nextIndex!, 0, result.object)
      })
    }
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

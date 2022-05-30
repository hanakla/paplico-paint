import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, VectorObject } from '../../DOM'

export class VectorTruncateContent implements ICommand {
  public readonly name = 'VectorTruncateContent'

  private prevContents!: VectorObject[]
  private pathToTargetLayer: string[]

  constructor({ pathToTargetLayer }: { pathToTargetLayer: string[] }) {
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    })

    this.prevContents = [...layer.objects]

    layer.update((l) => {
      l.objects.splice(0)
    })
  }

  async undo(document: Document): Promise<void> {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    })

    layer.update((l) => {
      l.objects.splice(0, 0, ...this.prevContents)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

import { PapDOMDigger } from '../../PapDOMDigger'
import { Document, GroupLayer, LayerTypes } from '../../DOM'
import { ICommand } from '../ICommand'

export class LayerMoveLayer implements ICommand {
  public readonly name = 'LayerMoveLayer'

  private move: {
    sourcePath: string[]
    targetGroupPath: string[]
    targetIndex: number

    sourceGroupPath: string[]
    sourceIndex: number | null
  }

  // private layer: LayerTypes
  // private aboveOnLayerId: string | null | undefined

  constructor({
    sourcePath,
    targetGroupPath,
    targetIndex,
  }: {
    sourcePath: string[]
    targetGroupPath: string[]
    targetIndex: number
  }) {
    this.move = {
      sourcePath,
      targetGroupPath,
      targetIndex,
      sourceGroupPath: sourcePath.slice(0, -1),
      sourceIndex: null,
    }
  }

  async do(document: Document): Promise<void> {
    const sourceLayer = PapDOMDigger.findLayer(document, this.move.sourcePath, {
      strict: true,
    })

    // Delete layer
    const sourceParent = PapDOMDigger.findLayerParent(
      document,
      this.move.sourcePath,
      { strict: true }
    )

    sourceParent.update((doc: Document | GroupLayer) => {
      this.move.sourceIndex = doc.layers.findIndex(
        (l) => l.uid === sourceLayer.uid
      )
      doc.layers.splice(this.move.sourceIndex, 1)
    })

    // Move layer
    const container =
      this.move.targetGroupPath.length === 0
        ? document
        : PapDOMDigger.findLayer(document, this.move.targetGroupPath, {
            kind: 'group',
            strict: true,
          })

    container.update((c: Document | GroupLayer) => {
      c.layers.splice(this.move.targetIndex, 0, sourceLayer)
    })
  }

  async undo(document: Document): Promise<void> {
    const sourceLayer = PapDOMDigger.findLayerRecursive(
      document,
      this.move.sourcePath.slice(-1)[0],
      { strict: true }
    )

    // Delete layer from moved target
    const movedTargetContainer =
      this.move.targetGroupPath.length === 0
        ? document
        : PapDOMDigger.findLayer(document, this.move.targetGroupPath, {
            kind: 'group',
            strict: true,
          })

    movedTargetContainer.update((doc: Document | GroupLayer) => {
      const index = doc.layers.findIndex((l) => l.uid === sourceLayer.uid)
      if (index === -1) return

      doc.layers.splice(index, 1)
    })

    // Move layer into source container
    const sourceContainer =
      this.move.sourceGroupPath.length === 0
        ? document
        : PapDOMDigger.findLayer(document, this.move.sourceGroupPath, {
            kind: 'group',
            strict: true,
          })

    sourceContainer.update((c: Document | GroupLayer) => {
      c.layers.splice(this.move.sourceIndex!, 0, sourceLayer)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [
      this.move.targetGroupPath,
      this.move.sourceGroupPath,
      this.move.sourcePath,
    ]
  }
}

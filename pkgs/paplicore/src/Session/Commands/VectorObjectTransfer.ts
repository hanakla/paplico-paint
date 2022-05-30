import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, VectorLayer, VectorObject } from '../../DOM'

type TransferEntry = {
  sourceContainerPath: string[]
  destContainerPath: string[]
  destIndex: number
  objectUid: string
}

export class VectorObjectTransfer implements ICommand {
  public readonly name = 'VectorObjectTransfer'

  private moves: Array<TransferEntry>
  private oldIndices: Record<string, number> = {}

  constructor({ moves }: { moves: Array<TransferEntry> }) {
    this.moves = moves
  }

  async do(document: Document) {
    const layers: Record<
      string,
      { source: VectorLayer; dest: VectorLayer; subjectObject: VectorObject }
    > = {}

    // Prefer check layers existance
    this.moves.forEach((entry) => {
      const source = PapDOMDigger.findLayer(
        document,
        entry.sourceContainerPath,
        {
          kind: 'vector',
          strict: true,
        }
      )

      const dest = PapDOMDigger.findLayer(document, entry.destContainerPath, {
        kind: 'vector',
        strict: true,
      })

      const object = source.objects.find((o) => o.uid === entry.objectUid)
      if (!object)
        throw new Error(`Object ${entry.objectUid} not found in source layer`)

      layers[entry.objectUid] = { source, dest, subjectObject: object }
    })

    this.moves.forEach((entry) => {
      const { source, dest, subjectObject: object } = layers[entry.objectUid]

      const idxInSource = (this.oldIndices[entry.objectUid] =
        source.objects.indexOf(object))

      source.update((sl) => {
        sl.objects.splice(idxInSource, 1)
      })
      dest.update((dl) => {
        dl.objects.splice(entry.destIndex, 0, object)
      })
    })
  }

  async undo(document: Document): Promise<void> {
    const layers: Record<
      string,
      { source: VectorLayer; dest: VectorLayer; subjectObject: VectorObject }
    > = {}

    // Prefer check layers existance
    this.moves.forEach((entry) => {
      const source = PapDOMDigger.findLayer(document, entry.destContainerPath, {
        kind: 'vector',
        strict: true,
      })

      const dest = PapDOMDigger.findLayer(document, entry.sourceContainerPath, {
        kind: 'vector',
        strict: true,
      })

      const object = source.objects.find((o) => o.uid === entry.objectUid)
      if (!object)
        throw new Error(`Object ${entry.objectUid} not found in source layer`)

      layers[entry.objectUid] = { source, dest, subjectObject: object }
    })

    this.moves.forEach((entry) => {
      const { source, dest, subjectObject } = layers[entry.objectUid]

      const index = source.objects.indexOf(subjectObject)
      if (index === -1) throw new Error('Object not found in source layer')

      source.objects.splice(index, 1)
      dest.objects.splice(this.oldIndices[entry.objectUid], 0, subjectObject)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return this.moves
      .map((e) => [e.sourceContainerPath, e.destContainerPath])
      .flat(1)
  }
}

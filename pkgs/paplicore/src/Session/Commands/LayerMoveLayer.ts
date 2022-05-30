import { PapDOMDigger } from '../../PapDOMDigger'
import { Document, GroupLayer, LayerTypes } from '../../DOM'
import { ICommand } from '../ICommand'

type MoveEntry = {
  layerPath: string[]
  targetContainerPath: string[]
  targetIndex: number
}

export class LayerMoveLayer implements ICommand {
  public readonly name = 'LayerMoveLayer'

  private moves: MoveEntry[]
  private oldPositions: Record<
    /* layer.uid */ string,
    { pathToContainerLayer: string[] | null; index: number }
  > = {}

  private newPositions: Record<string, string[]> = {}

  constructor({ moves }: { moves: MoveEntry[] }) {
    this.moves = moves
  }

  async do(document: Document): Promise<void> {
    const layers: Record<
      string,
      {
        container: GroupLayer | Document
        sourceParentPath: string[] | null
        target: GroupLayer | Document
        subjectLayer: LayerTypes
      }
    > = {}

    // Prefer check layers existance
    this.moves.forEach((entry) => {
      const subjectLayer = PapDOMDigger.findLayer(document, entry.layerPath, {
        strict: true,
      })

      const sourceParent = PapDOMDigger.findParentLayers(
        document,
        subjectLayer.uid,
        {
          strict: true,
        }
      )

      const target =
        entry.targetContainerPath.length >= 1
          ? PapDOMDigger.findLayer(document, entry.targetContainerPath, {
              kind: 'group',
              strict: true,
            })
          : document

      layers[entry.layerPath.join('.')] = {
        container: sourceParent.parent,
        sourceParentPath: sourceParent.path,
        target,
        subjectLayer,
      }
    })

    // Apply
    this.moves.forEach((entry) => {
      const { container, sourceParentPath, target, subjectLayer } =
        layers[entry.layerPath.join('.')]

      const idxInSource = container.layers.indexOf(subjectLayer)

      this.oldPositions[subjectLayer.uid] = {
        pathToContainerLayer: sourceParentPath,
        index: idxInSource,
      }

      this.newPositions[subjectLayer.uid] = [
        ...entry.targetContainerPath,
        subjectLayer.uid,
      ]

      container.update((sl) => {
        sl.layers.splice(idxInSource, 1)
      })

      target.update((tl) => {
        tl.layers.splice(entry.targetIndex, 0, subjectLayer)
      })
    })
  }

  async undo(document: Document): Promise<void> {
    const layers: Record<
      string,
      {
        container: GroupLayer | Document
        sourceParentPath: string[] | null
        target: GroupLayer | Document
        subjectLayer: LayerTypes
      }
    > = {}

    // Prefer check layers existance
    this.moves.forEach((entry) => {
      const subjectLayer = PapDOMDigger.findLayer(document, entry.layerPath, {
        strict: true,
      })

      const sourceParent = PapDOMDigger.findParentLayers(
        document,
        subjectLayer.uid,
        {
          strict: true,
        }
      )

      const oldParentPath =
        this.oldPositions[subjectLayer.uid].pathToContainerLayer
      const target = oldParentPath
        ? PapDOMDigger.findLayer(document, oldParentPath, {
            kind: 'group',
            strict: true,
          })
        : document

      layers[entry.layerPath.join('.')] = {
        container: sourceParent.parent,
        sourceParentPath: sourceParent.path,
        target,
        subjectLayer,
      }
    })

    // Apply
    this.moves.forEach((entry) => {
      const { container, sourceParentPath, subjectLayer, target } =
        layers[entry.layerPath.join('.')]

      const origPosition = this.oldPositions[subjectLayer.uid]

      container.update((cl) => {
        cl.layers.splice(origPosition.index, 0, subjectLayer)
      })

      target.update((tl) => {
        tl.layers.splice(entry.targetIndex, 1)
      })
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  // private checkAndGetInstances(document: Document) {

  //   return layers
  // }

  get effectedLayers(): string[][] {
    return this.moves
      .map((e) => [e.layerPath, e.targetContainerPath])
      .flat(1)
      .concat(Object.values(this.newPositions))
  }
}

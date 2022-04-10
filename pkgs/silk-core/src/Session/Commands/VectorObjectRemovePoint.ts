import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { Document, Path } from '../../SilkDOM'

type Transform = {
  movement: { x: number; y: number }
}

export class VectorObjectRemovePoint implements ICommand {
  private indices: number[] = []
  private pathToTargetLayer: string[]
  private objectUid: string
  private reverter: [oldIndex: number, point: Path.PathPoint][] = []

  constructor({
    pointIndices,
    pathToTargetLayer,
    objectUid,
  }: {
    pointIndices: number[]
    pathToTargetLayer: string[]
    objectUid: string
  }) {
    this.indices = pointIndices
    this.pathToTargetLayer = pathToTargetLayer
    this.objectUid = objectUid
  }

  async do(document: Document) {
    SilkDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.objectUid,
      {
        strict: true,
      }
    ).update((o) => {
      this.indices.forEach((idx) => {
        const [point] = o.path.points.splice(idx, 1)
        this.reverter.push([idx, point])
      })
    })
  }

  async undo(document: Document): Promise<void> {}

  async redo(document: Document): Promise<void> {
    // TODO
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

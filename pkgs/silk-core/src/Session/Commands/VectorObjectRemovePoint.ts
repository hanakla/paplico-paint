import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { Document, Path } from '../../SilkDOM'

export class VectorObjectRemovePoint implements ICommand {
  private indices: readonly number[] = []
  private pathToTargetLayer: readonly string[]
  private objectUid: string
  private prevPath!: Path

  constructor({
    pointIndices,
    pathToTargetLayer,
    objectUid,
  }: {
    pointIndices: readonly number[]
    pathToTargetLayer: readonly string[]
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
      this.prevPath = o.path

      const path = o.path.clone()
      this.indices.forEach((idx) => path.points.splice(idx, 1))
      if (this.prevPath.isFreezed) path.freeze()

      o.path = path
    })
  }

  async undo(document: Document): Promise<void> {
    SilkDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.objectUid,
      {
        strict: true,
      }
    ).update((o) => {
      o.path = this.prevPath
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer as string[]]
  }
}

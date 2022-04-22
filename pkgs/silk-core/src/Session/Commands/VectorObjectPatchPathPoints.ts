import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { Document, Path, VectorObject } from '../../SilkDOM'
import { assign, pick } from '../../utils'
import * as jsondiff from 'jsondiffpatch'

export class VectorObjectPatchPathPoints implements ICommand {
  private patcher: (path: Path.PathPoint[]) => void
  private pathToTargetLayer: string[]
  private targetObjectUid: string

  private jsonDelta!: jsondiff.Delta

  constructor({
    patcher,
    pathToTargetLayer,
    objectUid,
  }: {
    pathToTargetLayer: string[]
    objectUid: string
    patcher: (path: Path.PathPoint[]) => void
  }) {
    this.patcher = patcher
    this.pathToTargetLayer = pathToTargetLayer
    this.targetObjectUid = objectUid
  }

  async do(document: Document) {
    const object = SilkDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )

    const nextPath = object.path.clone()
    const jsonPoints = JSON.stringify(nextPath.points)

    const base = JSON.parse(jsonPoints)
    const next = JSON.parse(jsonPoints)
    this.patcher(next)

    this.jsonDelta = jsondiff.diff(base, next)!

    object.update((o) => {
      jsondiff.patch(nextPath.points, this.jsonDelta)
      if (object.path.isFreezed) nextPath.freeze()
      o.path = nextPath
    })
  }

  async undo(document: Document): Promise<void> {
    SilkDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )!.update((o) => {
      const nextPath = o.path.clone()
      nextPath.points = jsondiff.unpatch(nextPath.points, this.jsonDelta)

      if (o.path.isFreezed) nextPath.freeze()
      o.path = nextPath
    })
  }

  async redo(document: Document): Promise<void> {
    SilkDOMDigger.findObjectInLayer(
      document,
      this.pathToTargetLayer,
      this.targetObjectUid,
      {
        strict: true,
      }
    )!.update((o) => {
      const nextPath = o.path.clone()
      nextPath.points = jsondiff.patch(nextPath.points, this.jsonDelta)

      if (o.path.isFreezed) nextPath.freeze()
      o.path = nextPath
    })
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

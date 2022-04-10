import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { Document } from '../../SilkDOM'

type Transform = {
  movement: { x: number; y: number }
}

export class VectorObjectTransform implements ICommand {
  private objectUid: string
  private pathToTargetLayer: string[]
  private transform: Transform
  private skipDo: boolean

  constructor({
    objectUid,
    pathToTargetLayer,
    transform,
    skipDo,
  }: {
    objectUid: string
    pathToTargetLayer: string[]
    transform: Transform
    /** Flag if you already apply transform to object */
    skipDo: boolean
  }) {
    this.objectUid = objectUid
    this.pathToTargetLayer = pathToTargetLayer
    this.transform = transform
    this.skipDo = skipDo
  }

  async do(document: Document) {
    if (this.skipDo) return

    SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    }).update((l) => {
      const o = l.objects.find((o) => o.uid === this.objectUid)
      if (!o) return

      o.x += this.transform.movement.x
      o.y += this.transform.movement.y
    })
  }

  async undo(document: Document): Promise<void> {
    SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    }).update((l) => {
      const o = l.objects.find((o) => o.uid === this.objectUid)
      if (!o) return

      o.x -= this.transform.movement.x
      o.y -= this.transform.movement.y
    })
  }

  async redo(document: Document): Promise<void> {
    SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    }).update((l) => {
      const o = l.objects.find((o) => o.uid === this.objectUid)
      if (!o) return

      o.x += this.transform.movement.x
      o.y += this.transform.movement.y
    })
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}

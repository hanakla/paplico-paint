import { diff, patch, unpatch, Delta } from '@paplico/jsondiffpatch'
// ^-- Do not use star imports or named imports from jsondiffpatch-rc, it will break the build.

import { ICommand } from '../ICommand'
import { RuntimeDocument } from '@/Engine'
import { LayerEntity } from '@/Document/LayerEntity'
import { LayerNode } from '@/Document'

export class DocumentRemoveLayer implements ICommand {
  public readonly name = 'DocumentRemoveLayer'

  protected layerId: string

  protected parentPath: string[] | null = null
  protected removedNode: LayerNode | null = null
  protected removedLayer: LayerEntity | null = null

  constructor(targetLayerId: string) {
    this.layerId = targetLayerId
  }

  public async do(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')

    const path = document.document.findLayerNodePath(this.layerId)
    this.parentPath = path!.slice(0, -1)

    const removed = document.document.removeLayer(this.layerId)
    if (!removed) throw new Error('Remove layer failed')

    this.removedNode = removed.node
    this.removedLayer = removed.layer

    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async undo(document: RuntimeDocument): Promise<void> {
    if (!this.removedLayer) throw new Error('No removed layer')

    const parent = document.document.resolveNodePath(this.parentPath!)
    if (!parent) throw new Error('Parent layer not found')

    parent.children.push(this.removedNode!)

    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async redo(document: RuntimeDocument): Promise<void> {
    this.do(document)
  }

  get effectedLayers() {
    return [this.layerId]
  }
}

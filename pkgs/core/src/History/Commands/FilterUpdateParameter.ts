import { Delta, diff, unpatch } from '@paplico/jsondiffpatch'
import { ICommand } from '../ICommand'
import { RuntimeDocument } from '@/Engine'
import { deepClone } from '@/utils/object'

export class FilterUpdateParameter implements ICommand {
  public readonly name = 'FilterUpdateParameter'

  protected layerUid: string
  protected filterUid: string
  protected changedParam: Record<string, any>
  protected changesPatch: Delta | null = null

  constructor(
    layerUid: string,
    appearanceUid: string,
    changedParam: Record<string, any>,
  ) {
    this.layerUid = layerUid
    this.filterUid = appearanceUid
    this.changedParam = changedParam
  }

  public async do(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerUid)?.source
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType === 'artboard' || layer.layerType === 'root') return

    const filter = layer.filters.find((f) => f.uid === this.filterUid)
    if (!filter) throw new Error('Filter not found')

    const prev = deepClone(filter.settings)
    const next = deepClone(this.changedParam)

    this.changesPatch = diff(prev, next)!
    filter.settings = next
  }

  public async undo(document: RuntimeDocument): Promise<void> {
    if (!this.changesPatch) return

    const layer = document.resolveLayer(this.layerUid)?.source
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType === 'artboard' || layer.layerType === 'root') return

    const filter = layer.filters.find((f) => f.uid === this.filterUid)
    if (!filter) throw new Error('Filter not found')

    unpatch(filter.settings, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerUid)
  }

  public async redo(document: RuntimeDocument): Promise<void> {
    return this.do(document)
  }

  get effectedLayers() {
    return [this.layerUid]
  }
}

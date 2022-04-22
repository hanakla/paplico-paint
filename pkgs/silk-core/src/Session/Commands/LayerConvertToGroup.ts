import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { LayerProperties } from '../../SilkDOM/ILayer'
import { Document, GroupLayer } from '../../SilkDOM'
import { assign, pick } from '../../utils'

export class LayerConvertToGroup implements ICommand {
  private groupingLayerPathes: string[][] = []
  private group!: GroupLayer
  private sourceLocation: {
    [uid: string]: { parentPath: string[]; index: number }
  } = Object.create(null)

  constructor({ groupingLayerPathes }: { groupingLayerPathes: string[][] }) {
    this.groupingLayerPathes = groupingLayerPathes
  }

  async do(document: Document) {
    this.group = GroupLayer.create({ layers: [] })
    const groupInsertionPos = document.layers.findIndex(
      (l) => l.uid === this.groupingLayerPathes[0][0]
    )

    this.groupingLayerPathes.forEach((path) => {
      const layerId = path.slice(-1)[0]
      const pathToParent = path.slice(0, -1)

      const parent = SilkDOMDigger.findLayerParent(document, path)
      const index = parent.layers.findIndex((l) => l.uid === path.slice(-1)[0])

      const layer = SilkDOMDigger.findLayer(document, path, {
        strict: true,
        kind: ['vector', 'raster', 'filter', 'reference', 'text'],
      })

      parent.update((node) => {
        node.layers.splice(index, 1)
      })

      this.group.layers.push(layer)

      this.sourceLocation[layerId] = {
        parentPath: pathToParent,
        index: index,
      }
    })

    document.update((container) => {
      if (groupInsertionPos === -1) {
        container.addLayer(this.group)
      } else {
        container.layers.splice(groupInsertionPos, 0, this.group)
      }
    })
  }

  async undo(document: Document): Promise<void> {
    ;[...this.groupingLayerPathes].reverse().forEach((path) => {
      const layerId = path.slice(-1)[0]
      const sourceLoc = this.sourceLocation[layerId]

      const layer = SilkDOMDigger.findLayerRecursive(this.group, layerId, {
        strict: true,
      })
      const sourceParent =
        sourceLoc.parentPath.length === 0
          ? document
          : SilkDOMDigger.findLayer(document, sourceLoc.parentPath, {
              kind: 'group',
              strict: true,
            })

      sourceParent.update((container) => {
        container.layers.splice(sourceLoc.index, 0, layer)
      })
    })

    const pathToGroup = SilkDOMDigger.getPathToLayer(document, this.group.uid, {
      strict: true,
    })
    const groupParent = SilkDOMDigger.findLayerParent(document, pathToGroup)!
    const groupIndex = groupParent.layers.findIndex(
      (l) => l.uid === this.group.uid
    )

    if (groupIndex !== -1) {
      groupParent.update((container) => {
        container.layers.splice(groupIndex, 1)
      })
    }
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [...this.groupingLayerPathes, [this.group.uid]]
  }
}

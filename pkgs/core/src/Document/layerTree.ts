import { type PaplicoDocument } from './Document'
import { LayerNode } from './LayerNode'

export const getLayerNodeAt = (document: PaplicoDocument, path: string[]) => {
  let current: LayerNode[] | undefined = document.layerTree

  for (const key of path) {
    current = current!.find((node) => node.layerUid === key)?.children

    if (!current) {
      throw new Error(`LayerNode not found at ${path.join('/')}`)
    }
  }

  return current
}

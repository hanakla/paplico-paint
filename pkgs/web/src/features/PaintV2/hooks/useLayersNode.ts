import { Document } from '@paplico/core-new'
import { TreeViewItem } from 'react-draggable-tree'
import { usePaplicoEngine } from '../contexts/engine'

export type LayerTreeViewItem = TreeViewItem

export const useLayersNode = (): LayerTreeViewItem => {
  const engine = usePaplicoEngine()

  if (engine?.currentDocument?.layerTree) {
    return {
      key: 'layerRoot',
      parent: undefined,
      children: engine.currentDocument!.layerTree.map((node) =>
        buildTree(node)
      ),
    }
  }

  return {
    key: 'layerRoot',
    parent: undefined,
    children: [],
  }
}

function buildTree(
  node: Document.LayerNode,
  parent: TreeViewItem | undefined = undefined
): LayerTreeViewItem {
  const viewNode: LayerTreeViewItem = {
    key: node.layerUid,
    parent,
    children: [],
  }

  viewNode.children = node.children.map((child) => buildTree(child, viewNode))

  return viewNode
}

// export class LayerTreeViewItem implements TreeViewItem {
//   public children: LayerTreeViewItem[]

//   constructor(
//     public key: string,
//     public parent: LayerTreeViewItem | undefined
//   ) {}
// }

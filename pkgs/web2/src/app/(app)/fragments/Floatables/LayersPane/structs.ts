import { TreeNodeBase } from '@/components/TreeView'
import { Document } from '@paplico/core-new'
import { produce } from 'immer'

export type LayerTreeNode = {
  id: string
  visUid: string
  vis: Document.VisuElement.AnyElement
  path: string[]
  depth: number
  childrenCollapsed: boolean
  collapsed?: boolean
}

export function convertLayerNodeToTreeViewNode(
  document: Document.PaplicoDocument,
  node: Document.LayerNode,
) {
  const items: LayerTreeNode[] = []

  const flattenChildren = (
    node: Document.LayerNode,
    parentPath: string[],
    depth: number,
  ) => {
    items.push({
      id: node.visuUid,
      visUid: node.visuUid,
      vis: document.getVisuallyByUid(node.visuUid)!,
      path: [...parentPath, node.visuUid],
      depth,
      childrenCollapsed: true,
      collapsed: depth > 0,
    })

    node.children.toReversed().forEach((child) => {
      flattenChildren(child, [...parentPath, node.visuUid], depth + 1)
    })
  }

  node.children.toReversed().forEach((child) => {
    flattenChildren(child, [], 0)
  })

  return items
}

export function updateTree(
  tree: LayerTreeNode[],
  targetVisUid: string,
  { childrenCollapsed }: { childrenCollapsed?: boolean },
) {
  return produce(tree, (d) => {
    if (childrenCollapsed != null) {
      const targetIdx = d.findIndex((node) => node.visUid === targetVisUid)
      if (targetIdx === -1) return

      d[targetIdx].childrenCollapsed = childrenCollapsed
      d.slice(targetIdx + 1).forEach((node) => {
        if (isChildNode(d[targetIdx].path, node.path)) {
          node.collapsed = childrenCollapsed
        }
      })
    }
  })
}

export function mergeNextTree(
  oldTree: LayerTreeNode[],
  newTree: LayerTreeNode[],
) {
  const oldTreeMap = new Map(oldTree.map((node) => [node.visUid, node]))

  return newTree.map((node) => {
    const oldNode = oldTreeMap.get(node.visUid)
    if (!oldNode) return node

    return {
      ...node,
      childrenCollapsed: oldNode.childrenCollapsed,
      collapsed: oldNode.collapsed,
    }
  })
}

function isChildNode(parentPath: string[], matchPath: string[]) {
  if (parentPath.length >= matchPath.length) return false

  return parentPath.every((p, idx) => p === matchPath[idx])
}

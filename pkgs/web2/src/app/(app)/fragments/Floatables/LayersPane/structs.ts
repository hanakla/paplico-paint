import { Active, Over } from '@dnd-kit/core'
import { Document } from '@paplico/core-new'
import { produce, setAutoFreeze } from 'immer'

export type LayerTreeNode = {
  id: string
  visUid: string
  visu: Document.VisuElement.AnyElement
  path: string[]
  depth: number

  collapsed: boolean

  dragging: boolean
  collapsedByParent: boolean
  invisibleByParent: boolean
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
    parentVisibility: boolean | null = null,
  ) => {
    const visu = document.getVisuByUid(node.visuUid)!
    parentVisibility ??= visu.visible

    items.push({
      id: node.visuUid,
      visUid: node.visuUid,
      visu,
      path: [...parentPath, node.visuUid],
      depth,
      dragging: false,
      collapsed: true,
      collapsedByParent: depth > 0,
      invisibleByParent: !parentVisibility,
    })

    node.children.toReversed().forEach((child) => {
      flattenChildren(
        child,
        [...parentPath, node.visuUid],
        depth + 1,
        parentVisibility,
      )
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
  {
    visible,
    childrenCollapsed,
    dragging,
  }: { visible?: boolean; childrenCollapsed?: boolean; dragging?: boolean },
) {
  setAutoFreeze(false)

  return produce(tree, (d) => {
    if (visible != null) {
      const targetIdx = d.findIndex((node) => node.visUid === targetVisUid)
      if (targetIdx === -1) return

      d[targetIdx].invisibleByParent = !visible
      d.slice(targetIdx + 1).forEach((node) => {
        if (isChildNode(d[targetIdx].path, node.path)) {
          node.invisibleByParent = !visible
        }
      })
    }

    if (childrenCollapsed != null) {
      const targetIdx = d.findIndex((node) => node.visUid === targetVisUid)
      if (targetIdx === -1) return

      d[targetIdx].collapsed = childrenCollapsed
      d.slice(targetIdx + 1).forEach((node) => {
        if (isChildNode(d[targetIdx].path, node.path)) {
          node.collapsedByParent = childrenCollapsed
        }
      })
    }

    if (dragging != null) {
      const targetIdx = d.findIndex((node) => node.visUid === targetVisUid)
      if (targetIdx === -1) return

      d[targetIdx].dragging = dragging

      d.slice(targetIdx + 1).forEach((node) => {
        if (isChildNode(d[targetIdx].path, node.path)) {
          node.collapsedByParent = d[targetIdx].collapsed || dragging
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
      collapsed: oldNode.collapsed,
      collapsedByParent: oldNode.collapsedByParent,
      invisibleByParent: oldNode.invisibleByParent,
    }
  })
}

export function getNextNodePath(
  document: Document.PaplicoDocument,
  tree: LayerTreeNode[],
  active: Active,
  /** Will insert to */
  over: Over | null,
) {
  if (active.id === over?.id) return null
  if (!over) return null

  const activeNode = tree.find((node) => node.visUid === active.id)
  const overNode = tree.find((node) => node.visUid === over.id)
  if (!activeNode || !overNode) return null

  const overParentPath = overNode.path.slice(0, -1)
  const overParent = document.layerNodes.getNodeAtPath(overParentPath)
  if (!overParent) return null

  console.log(document.layerNodes.isChildrenContainableNode(overParent))
}

function isChildNode(parentPath: string[], matchPath: string[]) {
  if (parentPath.length >= matchPath.length) return false

  return parentPath.every((p, idx) => p === matchPath[idx])
}

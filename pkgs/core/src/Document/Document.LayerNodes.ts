import {
  PPLCIgnoreableError,
  PPLCInvalidOptionOrStateError,
  PPLCTargetNodeNotFoundError,
} from '@/Errors'
import { type PaplicoDocument } from './Document'
import { type LayerNode } from './LayerNode'
import { VisuElement } from './Visually'

export type NodesController = {
  getRootNode(): LayerNode
  getNodeAtPath(path: string[]): LayerNode | null

  getFlattenNodesUnderPath(path: string[]): LayerNode[] | null

  /**
   * Get ancestor of specified node contained node (likes GroupVisuallly)
   * @param Ancestor node list. first is root. last is parent
   */
  getAncestorContainerNode(path: string[]): LayerNode[] | null

  /**
   *  Add new Visually into specified node,
   * @param pathToParent Default to point Root node
   * @param positionInNode Index in siblings, default to most priorize position in render order
   * @return Added node position and Visu
   */
  addLayerNode<T extends VisuElement.AnyElement>(
    visu: T,
    pathToParent?: string[],
    positionInNode?: number,
  ): {
    visu: T
    nodePath: string[]
    indexInParent: number
  }

  /**
   * @returns Removed node and Visually
   * @throws PPLCTargetNodeNotFoundError when node not found
   */
  removeNodeAt(path: string[]): {
    visu: VisuElement.AnyElement
    node: LayerNode
    indexInParent: number
  }

  findNodePathByVisu(visuallyUid: string): string[] | null

  isChildrenContainableNode(path: string[]): boolean
  isChildrenContainableNode(node: LayerNode): boolean
}

export function createNodesController(doc: PaplicoDocument): NodesController {
  const rootNode = doc.layerTreeRoot

  let me: NodesController
  return (me = {
    getRootNode() {
      return rootNode
    },
    getNodeAtPath(path) {
      if (path[0] === '__root__') path = path.slice(1)
      if (path.length === 0) return rootNode

      let cursor = rootNode

      for (const uid of path) {
        let result = cursor.children.find((node) => node.visuUid === uid)
        if (!result) return null

        cursor = result
      }

      return cursor
    },

    getFlattenNodesUnderPath(path: string[]) {
      const node = me.getNodeAtPath(path)
      if (!node) return null

      const flatten: LayerNode[] = []

      const dig = (node: LayerNode) => {
        flatten.push(node)
        node.children.forEach(dig)
      }

      dig(node)

      return flatten
    },

    getAncestorContainerNode(path: string[]) {
      if (path[0] === '__root__') path = path.slice(1)
      if (path.length === 0) return [rootNode]

      const ancestors: LayerNode[] = [rootNode]

      let cursor = rootNode
      for (const uid of path) {
        let found = cursor.children.find((child) => child.visuUid === uid)
        if (!found) return null
        ancestors.push(found)
      }

      console.log([...ancestors])
      // pop leaf node
      ancestors.pop()

      return ancestors
    },

    addLayerNode<T extends VisuElement.AnyElement>(
      visu: T,
      pathToParent: string[] = [],
      positionInNode: number = -1,
    ) {
      if (!doc.visuElements.find((l) => l.uid === visu.uid)) {
        doc.visuElements.push(visu)
      }

      const parent = me.getNodeAtPath(pathToParent)
      if (!parent) {
        throw new PPLCTargetNodeNotFoundError(
          `Document.addLayer: Parent node not found (path: ${pathToParent.join(
            ' > ',
          )})`,
        )
      }

      let indexInParent: number

      if (positionInNode === -1) {
        parent?.children.push({ visuUid: visu.uid, children: [] })
        indexInParent = parent.children.length - 1
      } else {
        parent?.children.splice(positionInNode, 0, {
          visuUid: visu.uid,
          children: [],
        })

        indexInParent = positionInNode
      }

      return {
        visu: visu,
        nodePath: [...pathToParent, visu.uid],
        indexInParent,
      }
    },

    removeNodeAt(path: string[]) {
      const targetNodeUid = path.at(-1)

      console.log(this.getAncestorContainerNode(path))
      const parent = this.getAncestorContainerNode(path)?.at(-1)
      if (!parent) {
        throw new PPLCTargetNodeNotFoundError(
          `Document.layerNodes.removeNodeAt: Node not found (on removing ${path.join(
            '/',
          )})`,
        )
      }

      const idxInNodes = parent.children.findIndex(
        (n) => n.visuUid === targetNodeUid,
      )
      const idxInElements = doc.visuElements.findIndex(
        (n) => n.uid === targetNodeUid,
      )

      const [removedNode] = parent.children.splice(idxInNodes, 1)
      const [removedVis] = doc.visuElements.splice(idxInElements, 1)

      return {
        visu: removedVis,
        node: removedNode,
        indexInParent: idxInNodes,
      }
    },

    findNodePathByVisu(visuallyUid: string): string[] | null {
      if (visuallyUid === '__root__') return ['__root__']

      const path: string[] = []
      const digNodes = (node: LayerNode): boolean => {
        for (const child of node.children) {
          if (child.visuUid === visuallyUid) {
            path.unshift(child.visuUid)
            return true
          }

          if (digNodes(child)) {
            path.unshift(child.visuUid)
            return true
          }
        }

        return false
      }

      if (digNodes(rootNode)) {
        return path
      }

      return null
    },

    isChildrenContainableNode(nodeOrPath: LayerNode | string[]) {
      let node: LayerNode

      if (Array.isArray(nodeOrPath)) {
        const target = me.getNodeAtPath(nodeOrPath)

        if (!target) {
          throw new PPLCTargetNodeNotFoundError(
            `Node not found: ${nodeOrPath.join('/')}`,
          )
        }

        node = target
      } else {
        node = nodeOrPath
      }

      const visu = doc.getVisuByUid(node.visuUid)
      if (!visu) return false

      return doc.isChildrenContainableVisu(visu)
    },
  })
}

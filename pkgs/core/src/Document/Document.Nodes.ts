import { PaplicoIgnoreableError } from '@/Errors'
import { type PaplicoDocument } from './Document'
import { type LayerNode } from './LayerNode'
import { VisuElement } from './Visually'

export type NodesController = {
  getRootNode(): LayerNode
  getNodeAtPath(path: string[]): LayerNode | null

  /**
   * Get ancestor of specified node contained node (likes GroupVisuallly)
   * @param Ancestor node list. first is root. last is parent
   */
  getAncestorContainerNode(path: string[]): LayerNode[] | null

  /**
   *  Add new Visually into specified node,
   * @param pathToParent Default to point Root node
   * @param positionInNode Index in siblings, default to most priorize position in render order
   */
  addLayerNode(
    vissualy: VisuElement.AnyElement,
    pathToParent?: string[],
    positionInNode?: number,
  ): void

  /**
   * @returns Removed node and Visually
   * @throws PaplicoIgnoreableError when node not found
   */
  removeNodeAt(path: string[]): {
    visually: VisuElement.AnyElement
    node: LayerNode
    indexInParent: number
  }

  findNodePathByVisually(visuallyUid: string): string[] | null

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

    getAncestorContainerNode(path: string[]) {
      if (path[0] === '__root__') path = path.slice(1)
      if (path.length === 0) return [rootNode]

      const ancestors: LayerNode[] = []

      let cursor = rootNode
      for (const uid of path) {
        let found = cursor.children.find((child) => child.visuUid === uid)
        if (!found) return null
        ancestors.push(found)
      }

      // pop leaf node
      ancestors.pop()

      return ancestors
    },

    addLayerNode(
      vissualy: VisuElement.AnyElement,
      pathToParent: string[] = [],
      positionInNode: number = -1,
    ) {
      if (doc.visuElements.find((l) => l.uid === vissualy.uid)) {
        console.warn(
          `Document.addLayer: Layer already exists (uid: ${vissualy.uid})`,
        )
        return
      }

      doc.visuElements.push(vissualy)

      const parent = me.getNodeAtPath(pathToParent)
      if (!parent) {
        throw new Error(
          `Document.addLayer: Parent node not found (path: ${pathToParent.join(
            ' > ',
          )})`,
        )
      }

      // this

      if (positionInNode === -1) {
        parent?.children.push({ visuUid: vissualy.uid, children: [] })
      } else {
        parent?.children.splice(positionInNode, 0, {
          visuUid: vissualy.uid,
          children: [],
        })
      }
    },

    removeNodeAt(path: string[]) {
      const targetNodeUid = path.at(-1)

      const parent = this.getAncestorContainerNode(path)?.at(-1)
      if (!parent) {
        throw new PaplicoIgnoreableError(
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
        visually: removedVis,
        node: removedNode,
        indexInParent: idxInNodes,
      }
    },

    findNodePathByVisually(visuallyUid: string): string[] | null {
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

    isChildrenContainableNode(node: LayerNode) {
      const vis = doc.getVisuallyByUid(node.visuUid)
      if (!vis) return false

      return vis.type === 'group'
    },
  })
}

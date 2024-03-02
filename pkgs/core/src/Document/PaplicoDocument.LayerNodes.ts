import {
  PPLCOptionInvariantViolationError,
  PPLCTargetEntityNotFoundError,
} from '@/Errors'
import { type PaplicoDocument } from './PaplicoDocument'
import { type LayerNode } from './Structs/LayerNode'
import { VisuElement } from './Visually/VisuElement'

export type NodesController = {
  getRootNode(): LayerNode

  /**
   * Get LayerNode at specified path
   * @returns LayerNode or null when node not found
   */
  getNodeAtPath(path: string[]): LayerNode | null

  /**
   * Get layer node data some likes StrokingTarget structure
   */
  getNodeDetailAtPath(path: string[]): {
    visuType: VisuElement.AnyElement['type']
    visuUid: string
    nodePath: string[]
    visu: VisuElement.AnyElement
  } | null

  /**
   * Get Visually instance combined layer nodes which under of pointed node by `path`
   * @param path
   * @returns instance
   */
  getResolvedLayerNodes(path: string[]): PaplicoDocument.ResolvedLayerNode

  getFlattenNodesUnderPath(path: string[]): LayerNode[] | null

  /**
   * Get ancestor of specified node contained node (likes GroupVisuallly)
   * @param Ancestor node list. first is root. last is parent
   */
  getAncestorNodes(path: string[], includeSelf?: boolean): LayerNode[] | null

  /**
   *  Add new Visually into specified node,
   * @param pathToParent Default to point Root node
   * @param positionInNode Index in siblings, default to most priorize position in render order
   * @return Added node position and Visu
   * @throws PPLCTargetNodeNotFoundError when target parent not found
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
  removeLayerNode(path: string[]): {
    visu: VisuElement.AnyElement
    node: LayerNode
    indexInParent: number
  }

  /**
   * Move layer to position of `overNode`
   * if last fragment of overPath is PLACE_IT, move to top of group
   *
   * Ex. move target is empty group (/group2/ fo below)
   *
   *  /__root__
   *    /group1/
   *      /canvas-visu
   *    /group2/
   *     ## Want to place it##
   *
   *  Specify overPath as `/group2/PLACE_IT`
   */
  moveLayerNodeOver(
    sourcePath: string[],
    overPath: [...string[], 'PLACE_IT'] | string[],
  ): { newPath: string[] }

  findNodePathByVisu(visuUid: string): string[] | null

  /** Check to target node or visu can be set to stroking target */
  isDrawableNode(path: string[]): boolean
  isDrawableNode(node: LayerNode): boolean

  /** Check to target node can be add child visu */
  isChildContainableNode(path: string[]): boolean
  isChildContainableNode(node: LayerNode): boolean
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

    getNodeDetailAtPath(path) {
      const node = me.getNodeAtPath(path)
      if (!node) return null

      const visu = doc.getVisuByUid(node.visuUid)
      if (!visu) return null

      return {
        visuType: visu.type,
        visuUid: visu.uid,
        nodePath: path,
        visu,
      }
    },

    getResolvedLayerNodes(path: string[]): PaplicoDocument.ResolvedLayerNode {
      const node = me.getNodeAtPath(path)

      if (!node)
        throw new Error(`PaplicoDocument.getResolvedLayerNodes: node not found`)

      const layer = doc.getVisuByUid(node.visuUid)
      if (!layer)
        throw new Error(`PaplicoDocument.getResolvedLayerNodes: Visu not found`)

      return {
        uid: node.visuUid,
        visu: layer,
        path: [...path],
        children: node.children.map((child) => {
          return this.getResolvedLayerNodes([...path, child.visuUid])
        }),
      }
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

    getAncestorNodes(path: string[], includeSelf = false) {
      if (path[0] === '__root__') path = path.slice(1)
      if (path.length === 0) return [rootNode]

      const ancestors: LayerNode[] = [rootNode]

      let cursor = rootNode
      for (const uid of path) {
        let found = cursor.children.find((child) => child.visuUid === uid)
        if (!found) return null

        cursor = found
        ancestors.push(found)
      }

      if (!includeSelf) {
        // pop leaf node
        ancestors.pop()
      }

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
        throw new PPLCTargetEntityNotFoundError(
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

    removeLayerNode(path: string[]) {
      const targetNodeUid = path.at(-1)

      const parent = this.getAncestorNodes(path)?.at(-1)
      if (!parent) {
        throw new PPLCTargetEntityNotFoundError(
          `Document.layerNodes.removeNodeAt: Parent node not found (on removing ${path.join(
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

    moveLayerNodeOver(sourcePath, overPath) {
      // Stash 'PLACE_IT' fragment before searching target node
      const placeItMark = overPath.at(-1) === 'PLACE_IT'
      overPath = placeItMark ? overPath.slice(0, -1) : overPath

      const sourceNodeAncestors = me.getAncestorNodes(sourcePath, true)
      const sourceNode = sourceNodeAncestors?.at(-1)!
      const sourceParent = sourceNodeAncestors?.at(-2)

      const overNodeAncestors = me.getAncestorNodes(overPath, true)
      const overNode = overNodeAncestors?.at(-1)
      const overParentNode = placeItMark ? overNode : overNodeAncestors?.at(-2)

      if (
        !sourceNodeAncestors ||
        !overNode ||
        !overParentNode ||
        !sourceParent
      ) {
        // prettier-ignore
        throw new PPLCTargetEntityNotFoundError(
          `Document.layerNodes.moveNodeOver: target node not found for ${
            !sourceNodeAncestors ? `source /${sourcePath.join('/')}`
              : !overNode ? `over /${overPath.join('/')}`
              : !overParentNode ? `parent of over /${overPath.join('/')}`
              : !sourceParent ? `parent of source /${sourcePath.join('/')}`
              : 'unknown reason'
          }`,
        )
      }

      console.log(overParentNode)

      if (placeItMark) {
        if (!me.isChildContainableNode(overParentNode)) {
          throw new PPLCOptionInvariantViolationError(
            `Document.layerNodes.moveNodeOver: PLACE_IT mark can only use on group node, comes in ${overPath.join(
              '/',
            )}`,
          )
        }
      }

      const overIdxInParent = placeItMark
        ? overParentNode.children.length
        : overParentNode.children.findIndex(
            (n) => n.visuUid === overNode.visuUid,
          )

      const sourceIdxInParent = sourceParent.children.findIndex(
        (n) => n.visuUid === sourceNode.visuUid,
      )

      const [removed] = sourceParent.children.splice(sourceIdxInParent, 1)
      overParentNode.children.splice(overIdxInParent, 0, removed)

      return { newPath: [...overPath, removed.visuUid] }
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

    isDrawableNode<T extends string[] | LayerNode>(
      nodeOrPathOrVisu: T,
    ): boolean {
      let visu: VisuElement.AnyElement | undefined = undefined

      if (Array.isArray(nodeOrPathOrVisu)) {
        const target = me.getNodeAtPath(nodeOrPathOrVisu)
        visu = target ? doc.getVisuByUid(target.visuUid) : undefined

        if (!visu) {
          throw new PPLCTargetEntityNotFoundError(
            `Node not found: ${nodeOrPathOrVisu.join('/')}`,
          )
        }
      }

      if ('visuUid' in nodeOrPathOrVisu) {
        visu = doc.getVisuByUid(nodeOrPathOrVisu.visuUid)

        if (!visu) {
          throw new PPLCTargetEntityNotFoundError(
            `Node not found: ${nodeOrPathOrVisu.visuUid}`,
          )
        }
      }

      if (!visu) {
        throw new PPLCTargetEntityNotFoundError(
          `Visu not found (requested with ${JSON.stringify(nodeOrPathOrVisu)})`,
        )
      }

      return doc.isDrawableVisu(visu)
    },

    isChildContainableNode(nodeOrPath: LayerNode | string[]) {
      let node: LayerNode

      if (Array.isArray(nodeOrPath)) {
        const target = me.getNodeAtPath(nodeOrPath)

        if (!target) {
          throw new PPLCTargetEntityNotFoundError(
            `Node not found: ${nodeOrPath.join('/')}`,
          )
        }

        node = target
      } else {
        node = nodeOrPath
      }

      const visu = doc.getVisuByUid(node.visuUid)
      if (!visu) return false

      return doc.isChildContainableVisu(visu)
    },
  })
}

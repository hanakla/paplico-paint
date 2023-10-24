import { TreeNodeBase } from '@/components/TreeView'
import { Document } from '@paplico/core-new'

export function convertLayerNodeToTreeViewNode(
  document: Document.PaplicoDocument,
  node: Document.LayerNode,
  path: string[] = [],
  parent?: LayerTreeNode,
): LayerTreeNode {
  const item = new LayerTreeNode(
    node.layerUid,
    [...path, node.layerUid],
    parent,
  )
  const layer = (item.layer = document.resolveLayerEntity(node.layerUid)!)

  item.children = [
    ...[...node.children].reverse().map((child) => {
      return convertLayerNodeToTreeViewNode(
        document,
        child,
        [...path, layer.uid],
        item,
      )
    }),
    ...(layer.layerType === 'vector'
      ? [...layer.objects].reverse().map((object) => {
          return convertObjectToTreeViewNode(layer, object, item)
        })
      : []),
  ]

  return item
}

export function convertObjectToTreeViewNode(
  layer: VectorLayer,
  object: Document.VectorObject | Document.VectorGroup,
  parent?: LayerNodes,
): VectorObjectTreeNode {
  const item = new VectorObjectTreeNode(object.uid, parent)
  item.object = object
  item.children =
    object.type === 'vectorGroup'
      ? object.children.map((child) => {
          return convertObjectToTreeViewNode(layer, child, item)
        })
      : []
  return item
}

abstract class Base<T> extends TreeNodeBase<T> {
  protected _children: T[] = []
  public collapsed = true

  constructor(key: string, parent?: Base<T>) {
    super(key, parent)
    this.collapsed = !!parent
  }

  abstract get type(): 'leaf' | 'branch'
  public abstract canDroppable(draggedItem: this): boolean
  public abstract insertBefore(child: this, next: this | undefined): void

  public get children(): T[] {
    if (this.collapsed) return []
    return this._children
  }

  public set children(children: T[]) {
    this._children = children
  }

  public hasChildren(): boolean {
    return this._children.length > 0
  }
}

export type LayerNodes = VectorObjectTreeNode | LayerTreeNode

export class VectorObjectTreeNode extends Base<VectorObjectTreeNode> {
  public object!: Document.VectorObject | Document.VectorGroup

  get type(): 'leaf' | 'branch' {
    // prettier-ignore
    return this.object.type === 'vectorObject' ? 'leaf'
      : this.object.type === 'vectorGroup' ? 'branch'
      : 'leaf'
  }

  public canDroppable(draggedItem: LayerTreeNode | this) {
    if (draggedItem instanceof LayerTreeNode) {
      return false
    }
    if (draggedItem instanceof VectorObjectTreeNode) {
      return true
    }

    return false
  }
}

export class LayerTreeNode extends Base<LayerNodes> {
  public layer!: Document.LayerEntity
  public layerPath: string[]

  get type(): 'leaf' | 'branch' {
    // prettier-ignore
    return this.layer.layerType === 'raster' ? 'leaf'
      : this.layer.layerType === 'vector' ? 'branch'
      : 'leaf'
  }

  constructor(key: string, path: string[], parent?: LayerTreeNode) {
    super(key, parent)
    this.layerPath = path
  }

  public canDroppable(draggedItem: LayerNodes) {
    if (draggedItem instanceof LayerTreeNode) {
      return true
    }

    if (
      draggedItem instanceof VectorObjectTreeNode &&
      this.layer.layerType === 'vector'
    ) {
      return true
    }
    return false
  }

  // get children(): readonly TreeViewNode[] {
  //   const children: TreeViewNode[] = []
  //   let node = this.firstChild
  //   while (node) {
  //     children.push(node)
  //     node = node.nextSibling as TreeViewNode | undefined
  //   }
  //   return children
  // }

  // public type: 'leaf' | 'branch' = 'leaf'
  // public name = ''
  // public selected = false
  // public collapsed = false

  // public nextSibling: TreeViewNode | undefined = undefined
  // public previousSibling: TreeViewNode | undefined = undefined
  // public firstChild: TreeViewNode | undefined = undefined
  // public lastChild: TreeViewNode | undefined = undefined

  // remove(): void {
  //   const parent = this.parent
  //   if (!parent) {
  //     return
  //   }

  //   const prev = this.previousSibling
  //   const next = this.nextSibling

  //   if (prev) {
  //     prev.nextSibling = next
  //   } else {
  //     parent.firstChild = next
  //   }
  //   if (next) {
  //     next.previousSibling = prev
  //   } else {
  //     parent.lastChild = prev
  //   }
  //   this.parent = undefined
  //   this.previousSibling = undefined
  //   this.nextSibling = undefined
  // }

  // insertBefore(child: TreeViewNode, next: TreeViewNode | undefined): void {
  //   if (child === next) {
  //     return
  //   }
  //   if (child.includes(this)) {
  //     throw new Error('Cannot insert node to its descendant')
  //   }
  //   if (next && next.parent !== this) {
  //     throw new Error('The ref node is not a child of this node')
  //   }
  //   child.remove()

  //   let prev = next ? next.previousSibling : this.lastChild
  //   if (prev) {
  //     prev.nextSibling = child
  //   } else {
  //     this.firstChild = child
  //   }
  //   if (next) {
  //     next.previousSibling = child
  //   } else {
  //     this.lastChild = child
  //   }
  //   child.previousSibling = prev
  //   child.nextSibling = next
  //   child.parent = this
  // }

  // append(...children: TreeViewNode[]): void {
  //   for (const child of children) {
  //     this.insertBefore(child, undefined)
  //   }
  // }

  // includes(other: TreeViewNode): boolean {
  //   if (this === other.parent) {
  //     return true
  //   }
  //   if (!other.parent) {
  //     return false
  //   }
  //   return this.includes(other.parent)
  // }

  // get root(): TreeViewNode {
  //   return this.parent?.root ?? this
  // }

  // select() {
  //   this.selected = true
  //   for (const child of this.children) {
  //     child.deselect()
  //   }
  // }

  // deselect() {
  //   this.selected = false
  //   for (const child of this.children) {
  //     child.deselect()
  //   }
  // }

  // get ancestorSelected(): boolean {
  //   return this.selected || (this.parent?.ancestorSelected ?? false)
  // }

  // get selectedDescendants(): TreeViewNode[] {
  //   if (this.selected) {
  //     return [this]
  //   }
  //   return this.children.flatMap((child) => child.selectedDescendants)
  // }
}

import { TreeViewItem, TreeViewItemRow } from 'react-draggable-tree'

interface NodeTreeViewItem extends TreeViewItem {
  readonly node: Node
}

export const TreeRow: React.FC<{
  rows: readonly TreeViewItemRow<NodeTreeViewItem>[]
  index: number
  item: NodeTreeViewItem
  depth: number
  indentation: number
  onChange: () => void
}> = ({ rows, index, item, depth, indentation, onChange }) => {
  const node = item.node

  const onCollapseButtonClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    node.collapsed = !node.collapsed
    onChange()
  }

  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.metaKey) {
      if (node.selected) {
        node.deselect()
      } else {
        node.select()
      }
    } else if (event.shiftKey) {
      let minSelectedIndex = index
      let maxSelectedIndex = index

      for (const [i, row] of rows.entries()) {
        if (row.item.node.selected) {
          minSelectedIndex = Math.min(minSelectedIndex, i)
          maxSelectedIndex = Math.max(maxSelectedIndex, i)
        }
      }

      for (let i = minSelectedIndex; i <= maxSelectedIndex; ++i) {
        rows[i].item.node.select()
      }
    } else {
      node.root.deselect()
      node.select()
    }

    onChange()
  }

  return (
    <div
      onClick={onClick}
      style={{
        paddingLeft: depth * indentation,
        color: 'white',
        background: node.selected
          ? 'blue'
          : node.ancestorSelected
          ? '#008'
          : 'black',
      }}
    >
      {node.firstChild !== undefined && (
        <span onClick={onCollapseButtonClick}>
          {node.collapsed ? '[+]' : '[-]'}
        </span>
      )}
      {node.name}
    </div>
  )
}

export class Node {
  readonly key = (Math.random() * 0xfffffffff).toString(36).slice(2)
  type: 'leaf' | 'branch' = 'leaf'
  name = ''
  selected = false
  collapsed = false
  parent: Node | undefined = undefined
  nextSibling: Node | undefined = undefined
  previousSibling: Node | undefined = undefined
  firstChild: Node | undefined = undefined
  lastChild: Node | undefined = undefined

  get children(): readonly Node[] {
    const children: Node[] = []
    let node = this.firstChild
    while (node) {
      children.push(node)
      node = node.nextSibling as Node | undefined
    }
    return children
  }

  remove(): void {
    const parent = this.parent
    if (!parent) {
      return
    }

    const prev = this.previousSibling
    const next = this.nextSibling

    if (prev) {
      prev.nextSibling = next
    } else {
      parent.firstChild = next
    }
    if (next) {
      next.previousSibling = prev
    } else {
      parent.lastChild = prev
    }
    this.parent = undefined
    this.previousSibling = undefined
    this.nextSibling = undefined
  }

  insertBefore(child: Node, next: Node | undefined): void {
    if (child === next) {
      return
    }
    if (child.includes(this)) {
      throw new Error('Cannot insert node to its descendant')
    }
    if (next && next.parent !== this) {
      throw new Error('The ref node is not a child of this node')
    }
    child.remove()

    let prev = next ? next.previousSibling : this.lastChild
    if (prev) {
      prev.nextSibling = child
    } else {
      this.firstChild = child
    }
    if (next) {
      next.previousSibling = child
    } else {
      this.lastChild = child
    }
    child.previousSibling = prev
    child.nextSibling = next
    child.parent = this
  }

  append(...children: Node[]): void {
    for (const child of children) {
      this.insertBefore(child, undefined)
    }
  }

  includes(other: Node): boolean {
    if (this === other.parent) {
      return true
    }
    if (!other.parent) {
      return false
    }
    return this.includes(other.parent)
  }

  get root(): Node {
    return this.parent?.root ?? this
  }

  select() {
    this.selected = true
    for (const child of this.children) {
      child.deselect()
    }
  }

  deselect() {
    this.selected = false
    for (const child of this.children) {
      child.deselect()
    }
  }

  get ancestorSelected(): boolean {
    return this.selected || (this.parent?.ancestorSelected ?? false)
  }

  get selectedDescendants(): Node[] {
    if (this.selected) {
      return [this]
    }
    return this.children.flatMap((child) => child.selectedDescendants)
  }
}

import { DragEvent, ReactNode, memo } from 'react'
import {
  TreeView as Original,
  TreeViewItem,
  TreeViewItemRow,
} from 'react-draggable-tree'

export namespace TreeView {
  export type DragStartCallback<T extends TreeViewItem> = (e: {
    item: T
    event: DragEvent
  }) => boolean

  export type DropCallback<T extends TreeViewItem> = (e: {
    item: T
    draggedItem?: T
    before?: T
    event: DragEvent
  }) => void

  export type CanDropCallback<T extends TreeViewItem> = (e: {
    item: T
    draggedItem?: T
    event: DragEvent
  }) => boolean

  export type DropBetweenIndicatorRender = (
    props: DropBetweenIndicatorRenderProps,
  ) => JSX.Element

  export type DropBetweenIndicatorRenderProps = {
    top: number
    left: number
  }

  export type DropOverIndicatorRender = (
    props: DropOverIndicatorRenderProps,
  ) => JSX.Element

  export type DropOverIndicatorRenderProps = {
    top: number
    height: number
  }

  export type RowRender<T extends TreeViewItem> = (
    props: RowRenderProps<T>,
  ) => JSX.Element

  export type RowRenderProps<T extends TreeViewItem> = {
    rows: readonly TreeViewItemRow<T>[]
    index: number
    item: T
    depth: number
    indentation: number
  }
}

type Props<T extends TreeViewItem> = {
  className?: string
  style?: React.CSSProperties
  hidden?: boolean
  header?: JSX.Element
  footer?: JSX.Element
  indentation?: number
  dropIndicatorOffset?: number
  nonReorderable?: boolean
  background?: ReactNode

  rootItem: T
  onDragStart: TreeView.DragStartCallback<T>
  onDrop: TreeView.DropCallback<T>
  canDrop: TreeView.CanDropCallback<T>

  dropBetweenIndicator: TreeView.DropBetweenIndicatorRender
  dropOverIndicator: TreeView.DropOverIndicatorRender
  renderRow: TreeView.RowRender<T>
}

type TreeViewComponent = <T extends TreeViewItem>(props: Props<T>) => ReactNode

export const TreeView: TreeViewComponent = memo(function TreeView<
  T extends TreeViewItem,
>({ onDragStart, onDrop, ...props }: Props<T>) {
  return (
    <Original<T> handleDragStart={onDragStart} handleDrop={onDrop} {...props} />
  )
}) as TreeViewComponent

export class TreeNodeBase<T> {
  public key!: string
  public parent: T | undefined = undefined
  public children: T[] = []

  constructor(key: string, parent?: any) {
    this.key = key
    this.parent = parent
  }
}

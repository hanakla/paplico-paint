import { FloatablePane } from '@/components/FloatablePane'
import { TreeView, TreeNodeBase } from '@/components/TreeView'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { usePaplico } from '@/domains/paplico'
import { Document } from '@paplico/core-new'
import React, {
  MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useUpdate } from 'react-use'
import useEvent from 'react-use-event-hook'
import {
  LayerNodes,
  LayerTreeNode,
  convertLayerNodeToTreeViewNode,
} from './Layers.structs'
import { emptyCoalease } from '@/utils/lang'
import { css, styled } from 'styled-components'
import {
  LayersIcon,
  TriangleDownIcon,
  TriangleUpIcon,
} from '@radix-ui/react-icons'
import { ScrollArea } from '@/components/ScrollArea'

type Props = {
  size: 'sm' | 'lg'
}

export const LayerTreeView = memo((props: Props) => {
  const { pap } = usePaplico()

  if (!pap?.currentDocument) {
    return null
  }

  return <LayerTreeViewImpl root={pap.currentDocument.layerTree} {...props} />
})

const LayerTreeViewImpl = memo(function LayerTreeViewImpl({
  root,
  size,
}: Props & {
  root: Document.LayerNode
}) {
  const { pap } = usePaplico()!
  const rerender = useUpdate()

  const [tree, setTree] = useState<LayerTreeNode>(() =>
    convertLayerNodeToTreeViewNode(pap!.currentDocument!, root),
  )

  const update = useCallback(() => {
    // setTree(tree)
    rerender()
  }, [])

  const handleClickItem = useEvent((item: LayerNodes) => {
    if (item instanceof LayerTreeNode) {
      console.log('hi')
      pap!.enterLayer(item.layerPath)
    }
  })

  const handleDragStart = useEvent<TreeView.DragStartCallback<LayerNodes>>(
    ({ item }) => {
      // if (!item.node.selected) {
      //   item.node.root.deselect()
      //   item.node.select()
      //   update()
      // }
      return true
    },
  )

  const handleDrop = useEvent<TreeView.DropCallback<LayerNodes>>(
    ({ item, draggedItem, before }) => {
      console.log({ draggedItem, item, before })
      // if (!draggedItem) return

      // for (const node of item.node.root.selectedDescendants) {
      //   item.insertBefore(node, before)
      // }
      // update()
    },
  )

  const canDrop = useEvent<TreeView.CanDropCallback<LayerNodes>>(
    ({ item, draggedItem }) => {
      return !!draggedItem && item.canDroppable(draggedItem)
    },
  )

  const BindedLayerTreeRow = useMemo(() => {
    return (props: TreeView.RowRenderProps<LayerNodes>) => {
      return (
        <LayerTreeRow
          {...props}
          size={size}
          onClick={handleClickItem}
          onChange={update}
        />
      )
    }
  }, [size, handleClickItem, update])

  useEffect(() => {
    const changed = () => {
      setTree(convertLayerNodeToTreeViewNode(pap!.currentDocument!, root))
    }

    pap!.on('activeLayerChanged', changed)
    pap!.on('history:affect', changed)
    return () => {
      pap!.off('activeLayerChanged', changed)
      pap!.off('history:affect', changed)
    }
  }, [pap])

  return (
    <FloatablePane
      paneId={FloatablePaneIds.layers}
      title={
        <>
          <LayersIcon
            css={css`
              margin-right: 4px;
            `}
          />{' '}
          Layers
        </>
      }
    >
      <ScrollArea
        css={css`
          background-color: var(--gray-3);
          min-height: 300px;
        `}
      >
        <TreeView<LayerNodes>
          rootItem={tree}
          background={
            <div
              style={{
                position: 'absolute',
                inset: 0,
              }}
              onClick={() => {
                item.node.deselect()
                update()
              }}
            />
          }
          canDrop={canDrop}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          dropBetweenIndicator={BetweenIndicator}
          dropOverIndicator={OverIndicator!}
          renderRow={BindedLayerTreeRow}
        />
      </ScrollArea>
    </FloatablePane>
  )
})

const BetweenIndicator = function BetweenIndicator({
  top,
  left,
}: TreeView.DropBetweenIndicatorRenderProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: '100%',
        height: '1px',
        background: 'var(--sky-8)',
      }}
    />
  )
}

const OverIndicator = function OverIndicator({
  top,
  height,
}: TreeView.DropOverIndicatorRenderProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: '100%',
        height,
        background: 'var(--sky-5)',
        opacity: 0.5,
      }}
    />
  )
}

const LayerTreeRow = ({
  item,
  depth,
  size,
  onChange,
  onClick,
}: TreeView.RowRenderProps<LayerNodes> & {
  size: 'sm' | 'lg'
  onChange: () => void
  onClick: (item: LayerNodes) => void
}) => {
  const { pap, papStore } = usePaplico()

  const handleCollapseButtonClick = useEvent((e: MouseEvent) => {
    e.stopPropagation()
    item.collapsed = !item.collapsed
    onChange()
  })

  const handleClick = useEvent(() => {
    onClick(item)
  })

  const layerImage = pap!.previews.getForLayer(item.key)

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        padding: 2px;
        font-size: var(--font-size-2);
        line-height: var(--line-height-2);

        & + & {
          border-top: 1px solid var(--gray-8);
        }
      `}
      onClick={handleClick}
      style={{
        background:
          item instanceof LayerTreeNode &&
          papStore.engineState?.activeLayer?.layerUid === item.layer.uid
            ? 'var(--sky-5)'
            : 'transparent',
      }}
    >
      <span
        css={css`
          display: inline-flex;
          min-width: 16px;
          align-items: center;
          opacity: 0.5;

          &:hover {
            opacity: 1;
          }
        `}
        style={{
          marginRight: 2 + depth * 12,
        }}
        onClick={handleCollapseButtonClick}
      >
        {item.hasChildren() &&
          (item.collapsed ? <TriangleUpIcon /> : <TriangleDownIcon />)}
      </span>

      <img
        css={css`
          border: none;
          /* border: 1px solid var(--gray-8); */
        `}
        src={layerImage?.url}
        style={
          size == 'sm'
            ? {
                width: 16,
                marginRight: 4,
                aspectRatio: '1',
              }
            : {
                width: 32,
                marginRight: 8,
                aspectRatio: '1 / 1.6',
              }
        }
        decoding="async"
        loading="lazy"
      />

      {item instanceof LayerTreeNode
        ? emptyCoalease(
            item.layer.name,
            <PlaceholderString>
              {item.layer.layerType === 'vector'
                ? 'Vector Layer'
                : 'Normal Layer'}
            </PlaceholderString>,
          )
        : 'Vector Object'}
    </div>
  )
}

const PlaceholderString = styled.span`
  color: var(--gray-10);
`

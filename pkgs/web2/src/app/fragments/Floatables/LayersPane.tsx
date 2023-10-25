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
import { RxPlus } from 'react-icons/rx'
import { emptyCoalease } from '@/utils/lang'
import { css, styled } from 'styled-components'
import {
  LayersIcon,
  TriangleDownIcon,
  TriangleUpIcon,
} from '@radix-ui/react-icons'
import { ScrollArea } from '@/components/ScrollArea'
import { DropdownMenu, DropdownMenuItem } from '@/components/DropdownMenu'
import { Box, Button, Select, Slider } from '@radix-ui/themes'
import { TextField } from '@/components/TextField'
import { Fieldset } from '@/components/Fieldset'
import { roundPrecision } from '@/utils/math'

type Props = {
  size?: 'sm' | 'lg'
}

export const LayersPane = memo(function Layers({ size = 'sm' }: Props) {
  const { pap, papStore } = usePaplico()

  const activeLayer = papStore.activeLayerEntity

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
      <Box
        css={css`
          margin: 8px 0 12px;
        `}
      >
        <Fieldset label="Layer name">
          <TextField
            size="1"
            value={activeLayer?.name ?? ''}
            placeholder={'<Layer name>'}
          />
        </Fieldset>

        <Fieldset
          label="Blend mode"
          valueField={activeLayer?.compositeMode ?? '<Blend mode>'}
        >
          <Select.Root size="1">
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="normal">Normal</Select.Item>
              <Select.Item value="multiply">Multiply</Select.Item>
              <Select.Item value="screen">Screen</Select.Item>
              <Select.Item value="overlay">Overlay</Select.Item>
            </Select.Content>
          </Select.Root>
        </Fieldset>

        <Fieldset
          label="Layer opacity"
          valueField={`${roundPrecision(
            (activeLayer?.opacity ?? 1) * 100,
            1,
          )}%`}
        >
          <Slider
            value={[activeLayer?.opacity ?? 1]}
            min={0}
            max={1}
            step={0.01}
          />
        </Fieldset>
      </Box>

      <ScrollArea
        css={css`
          background-color: var(--gray-3);
          min-height: 300px;
          border-radius: 4px 4px 0 0;
        `}
      >
        {!!pap?.currentDocument && (
          <LayerTreeView root={pap?.currentDocument?.layerTree} size={size} />
        )}
      </ScrollArea>
      <div
        css={css`
          display: flex;
          gap: 4px;
          padding: 4px;
          background-color: var(--gray-3);
          border-top: 1px solid var(--gray-6);
          border-radius: 0 0 4px 4px;
        `}
      >
        <DropdownMenu
          trigger={
            <Button
              css={css`
                margin: 0;
                color: var(--gray-11);
              `}
              variant="ghost"
              size="1"
            >
              <RxPlus />
            </Button>
          }
        >
          <DropdownMenuItem>Normal Layer</DropdownMenuItem>
          <DropdownMenuItem>Vector Layer</DropdownMenuItem>
        </DropdownMenu>
      </div>
    </FloatablePane>
  )
})

const LayerTreeView = memo(
  ({ root, size }: Props & { root: Document.LayerNode }) => {
    const pap = usePaplico().pap!

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
    )
  },
)

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
                ? '<Vector Layer>'
                : '<Normal Layer>'}
            </PlaceholderString>,
          )
        : 'Vector Object'}
    </div>
  )
}

const PlaceholderString = styled.span`
  color: var(--gray-10);
`

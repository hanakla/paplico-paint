import { FloatablePane } from '@/components/FloatablePane'
import { TreeView } from '@/components/TreeView'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { usePaplico, usePaplicoStore } from '@/domains/paplico'
import { Commands, Document } from '@paplico/core-new'
import React, {
  ChangeEvent,
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
  VectorObjectTreeNode,
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
import { storePicker } from '@/utils/zutrand'
import { usePropsMemo } from '@/utils/hooks'
import {
  ContextMenu,
  ContextMenuItemClickHandler,
  useContextMenu,
} from '@/components/ContextMenu'

type Props = {
  size?: 'sm' | 'lg'
}

type LayerContextMenuEvent =
  | {
      kind: 'layer'
      event: MouseEvent
      layerUid: string
    }
  | {
      kind: 'vectorObject'
      event: MouseEvent
      objectUid: string
    }

type LayerContextMenuParams = {
  layerUid: string
}

export const LayersPane = memo(function LayersPane({ size = 'sm' }: Props) {
  const { pap } = usePaplico()
  const papStore = usePaplicoStore(storePicker(['activeLayerEntity']))
  const rerender = useUpdate()
  const propsMemo = usePropsMemo()
  const layerItemMenu = useContextMenu<LayerContextMenuParams>()

  const activeLayer = papStore.activeLayerEntity

  const handleChangeLayerName = useEvent((e: ChangeEvent<HTMLInputElement>) => {
    if (!activeLayer) return

    const name = e.currentTarget.value

    pap?.command.do(
      new Commands.LayerUpdateAttributes(activeLayer.uid, {
        updater: (layer) => {
          layer.name = name
        },
      }),
    )
  })

  const handleClickAddLayer = useEvent((e: MouseEvent<HTMLDivElement>) => {
    if (!pap?.currentDocument) return

    const type = e.currentTarget.dataset.layerType!

    // prettier-ignore
    const layer =
      type === 'normal'
        ? Document.createRasterLayerEntity({
            width: pap?.currentDocument.meta.mainArtboard.width,
            height: pap?.currentDocument.meta.mainArtboard.height,
          })
      : type === 'vector'
        ? Document.createVectorLayerEntity({})
      : null

    if (!layer) return

    pap.command.do(
      new Commands.DocumentCreateLayer(layer, {
        layerPath: [],
        indexAtSibling: -1,
      }),
    )
  })

  const handleLayerItemContextMenu = useEvent((e: LayerContextMenuEvent) => {
    if (e.kind !== 'layer') return

    layerItemMenu.show({
      event: e.event,
      props: {
        layerUid: e.layerUid,
      },
    })
  })

  useEffect(() => {
    return pap?.on('history:affect', ({ layerIds }) => {
      if (layerIds.includes(activeLayer?.uid ?? '')) rerender()
    })
  }, [pap, activeLayer?.uid])

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
          display: flex;
          flex-flow: column;
          gap: 4px;
          margin: 8px 0 12px;
          padding: 8px;
          background-color: var(--gray-3);
          border-radius: 4px;
        `}
      >
        <Fieldset label="Layer name">
          <TextField
            size="1"
            value={activeLayer?.name ?? ''}
            placeholder={'<Layer name>'}
            onChange={handleChangeLayerName}
          />
        </Fieldset>

        <Fieldset
          label="Blend mode"
          valueField={activeLayer?.compositeMode ?? '<Blend mode>'}
        >
          {propsMemo.memo(
            'blendmode-fieldset-root',
            () => (
              <Select.Root size="1">
                <>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="normal">Normal</Select.Item>
                    <Select.Item value="multiply">Multiply</Select.Item>
                    <Select.Item value="screen">Screen</Select.Item>
                    <Select.Item value="overlay">Overlay</Select.Item>
                  </Select.Content>
                </>
              </Select.Root>
            ),
            [],
          )}
        </Fieldset>

        <Fieldset
          label="Layer opacity"
          valueField={`${roundPrecision(
            (activeLayer?.opacity ?? 1) * 100,
            1,
          )}%`}
        >
          <Slider
            css={css`
              padding: 8px 0;
            `}
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
          max-height: 600px;
          border-radius: 4px 4px 0 0;
        `}
      >
        {!!pap?.currentDocument && (
          <LayerTreeView
            root={pap?.currentDocument?.layerTree}
            size={size}
            onLayerItemContextMenu={handleLayerItemContextMenu}
          />
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
          <DropdownMenuItem
            data-layer-type="normal"
            onClick={handleClickAddLayer}
          >
            Normal Layer
          </DropdownMenuItem>
          <DropdownMenuItem
            data-layer-type="vector"
            onClick={handleClickAddLayer}
          >
            Vector Layer
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      <LayerItemContextMenu id={layerItemMenu.id} />
    </FloatablePane>
  )
})

const LayerItemContextMenu = memo<{ id: string }>(
  function LayerItemContextMenu({ id }) {
    const { pap } = usePaplico()

    const onClickRemove = useEvent<
      ContextMenuItemClickHandler<LayerContextMenuParams>
    >(({ props }) => {
      pap?.command.do(new Commands.DocumentRemoveLayer(props.layerUid))
    })

    return (
      <ContextMenu.Menu id={id}>
        <ContextMenu.Item onClick={onClickRemove}>Remove</ContextMenu.Item>
      </ContextMenu.Menu>
    )
  },
)

const LayerTreeView = memo(
  ({
    root,
    size,
    onLayerItemContextMenu,
  }: Props & {
    root: Document.LayerNode
    onLayerItemContextMenu: (e: LayerContextMenuEvent) => void
  }) => {
    const pap = usePaplico().pap!

    const rerender = useUpdate()
    const [tree, setTree] = useState<LayerTreeNode | null>(() =>
      pap?.currentDocument
        ? convertLayerNodeToTreeViewNode(pap.currentDocument, root)
        : null,
    )

    const update = useCallback(() => {
      // setTree(tree)
      rerender()
    }, [])

    const handleClickItem = useEvent((item: LayerNodes) => {
      if (item instanceof LayerTreeNode) {
        pap!.setStrokingTargetLayer(item.layerPath)
        rerender()
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
            onContextMenu={onLayerItemContextMenu}
          />
        )
      }
    }, [size, handleClickItem, update])

    useEffect(() => {
      const changed = () => {
        setTree(
          pap?.currentDocument
            ? convertLayerNodeToTreeViewNode(pap.currentDocument, root)
            : null,
        )
      }

      pap!.on('documentChanged', changed)
      pap!.on('activeLayerChanged', changed)
      pap!.on('history:affect', changed)
      return () => {
        pap!.off('documentChanged', changed)
        pap!.off('activeLayerChanged', changed)
        pap!.off('history:affect', changed)
      }
    }, [pap?.currentDocument])

    if (!tree) return null

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
  onContextMenu,
}: TreeView.RowRenderProps<LayerNodes> & {
  size: 'sm' | 'lg'
  onChange: () => void
  onClick: (item: LayerNodes) => void
  onContextMenu: (entity: LayerContextMenuEvent) => void
}) => {
  const { pap } = usePaplico()
  const papStore = usePaplicoStore(storePicker(['engineState']))

  const handleCollapseButtonClick = useEvent((e: MouseEvent) => {
    e.stopPropagation()
    item.collapsed = !item.collapsed
    onChange()
  })

  const handleClick = useEvent(() => {
    onClick(item)
  })

  const handleContextMenu = useEvent((e: MouseEvent) => {
    if (item instanceof LayerTreeNode) {
      onContextMenu({ kind: 'layer', event: e, layerUid: item.layer.uid })
    } else if (item instanceof VectorObjectTreeNode) {
      onContextMenu({
        kind: 'vectorObject',
        event: e,
        objectUid: item.object.uid,
      })
    }
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
      style={{
        background:
          item instanceof LayerTreeNode &&
          papStore.engineState?.activeLayer?.layerUid === item.layer.uid
            ? 'var(--sky-5)'
            : 'transparent',
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
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
              {
                // prettier-ignore
                item.layer.layerType === 'vector'? '<Vector Layer>'
                : item.layer.layerType === 'text' ? '<Text Layer>'
                : '<Normal Layer>'
              }
            </PlaceholderString>,
          )
        : 'Vector Object'}
    </div>
  )
}

const PlaceholderString = styled.span`
  color: var(--gray-10);
`

import { FloatablePane } from '@/components/FloatablePane'
import { TreeView } from '@/components/TreeView'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import {
  usePaplicoInstance,
  initializeOnlyUseEngineStore,
} from '@/domains/engine'
import { Commands, Document } from '@paplico/core-new'
import React, { ChangeEvent, MouseEvent, memo, useEffect } from 'react'
import { useUpdate } from 'react-use'
import useEvent from 'react-use-event-hook'
import { RxPlus } from 'react-icons/rx'
import { css, styled } from 'styled-components'
import { LayersIcon } from '@radix-ui/react-icons'
import { ScrollArea } from '@/components/ScrollArea'
import { DropdownMenu, DropdownMenuItem } from '@/components/DropdownMenu'
import { Box, Button, Select, Slider } from '@radix-ui/themes'
import { TextField } from '@/components/TextField'
import { Fieldset } from '@/components/Fieldset'
import { roundPrecision } from '@/utils/math'
import { useStateSync, usePropsMemo } from '@/utils/hooks'
import {
  ContextMenu,
  ContextMenuItemClickHandler,
  useContextMenu,
} from '@/components/ContextMenu'
import { useTranslation } from '@/lib/i18n'
import { layersPaneTexts } from '@/locales'
import { NewTreeView } from './LayersPane/NewTreeView'
import { StoreApi, create } from 'zustand'

type Props = {
  size?: 'sm' | 'lg'
}

type LayerContextMenuEvent = {
  kind: 'layer'
  event: MouseEvent
  layerUid: string
}

type LayerContextMenuParams = {
  layerUid: string
}

type LayersPaneStore = {
  selectedVisu: Document.VisuElement.AnyElement | null
  set: StoreApi<LayersPaneStore>['setState']
}

const useLayersPaneStore = create<LayersPaneStore>((get, set) => ({
  selectedVisu: null,
  set,
}))

export const LayersPane = memo(function LayersPane({ size = 'sm' }: Props) {
  const t = useTranslation(layersPaneTexts)
  const { pplc: pplc } = usePaplicoInstance()
  const { canvasEditor } = initializeOnlyUseEngineStore()
  const rerender = useUpdate()
  const propsMemo = usePropsMemo()
  const layerItemMenu = useContextMenu<LayerContextMenuParams>()

  const layersPaneStore = useLayersPaneStore()
  useStateSync(() => {
    layersPaneStore.set({
      selectedVisu: canvasEditor?.getStrokingTarget()?.visu,
    })
  }, [canvasEditor?.getStrokingTarget()?.visuUid])

  const strokeTarget = canvasEditor?.getStrokingTarget()

  const handleChangeLayerName = useEvent((e: ChangeEvent<HTMLInputElement>) => {
    if (!strokeTarget) return

    const name = e.currentTarget.value

    pplc?.command.do(
      new Commands.VisuUpdateAttributes(strokeTarget.visuUid, {
        updater: (layer) => {
          layer.name = name
        },
      }),
    )
  })

  const handleChangeCompositeMode = useEvent((mode: string) => {
    console.log(mode)

    pplc?.command.do(
      new Commands.VisuUpdateAttributes(strokeTarget!.visuUid, {
        updater: (layer) => {
          layer.blendMode = mode as any
        },
      }),
    )
  })

  const handleClickAddLayer = useEvent((e: MouseEvent<HTMLDivElement>) => {
    if (!pplc?.currentDocument) return

    const type = e.currentTarget.dataset.layerType!

    // prettier-ignore
    const visu =
      type === 'normal'
        ? Document.visu.createCanvasVisually({
            width: pplc?.currentDocument.meta.mainArtboard.width,
            height: pplc?.currentDocument.meta.mainArtboard.height,
          })
      : type === 'vector'
        ? Document.visu.createGroupVisually({})
      : null

    if (!visu) return

    pplc.command.do(
      new Commands.DocumentUpdateLayerNodes({
        add: [{ visu, parentNodePath: [], indexInNode: -1 }],
      }),
    )
  })

  useEffect(() => {
    return pplc?.on('history:affect', ({ layerIds }) => {
      if (layerIds.includes(strokeTarget?.visuUid ?? '')) rerender()
    })
  }, [pplc, strokeTarget?.visuUid])

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
          {t('title')}
        </>
      }
    >
      <Box
        css={css`
          display: flex;
          flex-flow: column;
          gap: 4px;
          margin: 0 0 8px;
          padding: 8px;
          background-color: var(--gray-3);
          border-radius: 4px;
        `}
      >
        {!layersPaneStore.selectedVisu ? (
          <PlaceholderStringSpan>
            Select a layer to show properties
          </PlaceholderStringSpan>
        ) : (
          <>
            <Fieldset label={t('layerName')}>
              <TextField
                size="1"
                value={strokeTarget?.vi ?? ''}
                placeholder={`<${t('layerName')}>`}
                onChange={handleChangeLayerName}
              />
            </Fieldset>

            <Fieldset
              label={t('compositeMode')}
              valueField={
                layersPaneStore.selectedVisu?.blendMode ?? '<Blend mode>'
              }
            >
              {propsMemo.memo(
                'blendmode-fieldset-root',
                () => (
                  <Select.Root
                    size="1"
                    value={layersPaneStore.selectedVisu?.blendMode}
                    onValueChange={handleChangeCompositeMode}
                  >
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
              label={t('opacity')}
              valueField={`${roundPrecision(
                (strokeTarget?.opacity ?? 1) * 100,
                1,
              )}%`}
            >
              <Slider
                css={css`
                  padding: 8px 0;
                `}
                value={[strokeTarget?.opacity ?? 1]}
                min={0}
                max={1}
                step={0.01}
              />
            </Fieldset>
          </>
        )}
      </Box>

      <ScrollArea
        css={css`
          display: flex;
          flex: 1;
          background-color: var(--gray-3);
          min-height: 300px;
          max-height: 600px;
          border-radius: 4px 4px 0 0;
        `}
      >
        {!!pplc?.currentDocument && (
          <NewTreeView
            css={`
              flex: 1;
            `}
            mode={'desktop'}
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
          pointer-events: all;
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
    </FloatablePane>
  )
})

// const LayerItemContextMenu = memo<{ id: string }>(
//   function LayerItemContextMenu({ id }) {
//     const { pplc: pap } = usePaplicoInstance()

//     const onClickRemove = useEvent<
//       ContextMenuItemClickHandler<LayerContextMenuParams>
//     >(({ props }) => {
//       pap?.command.do(
//         new Commands.DocumentUpdateLayerNodes({
//           remove: [props!.layerUid],
//         }),
//       )
//     })

//     return (
//       <ContextMenu.Menu id={id}>
//         <ContextMenu.Item onClick={onClickRemove}>Remove</ContextMenu.Item>
//       </ContextMenu.Menu>
//     )
//   },
// )

// const LayerTreeView = memo(
//   ({
//     root,
//     size,
//     onLayerItemContextMenu,
//   }: Props & {
//     root: Document.LayerNode
//     onLayerItemContextMenu: (e: LayerContextMenuEvent) => void
//   }) => {
//     // const pap = usePaplicoInstance().pplc!

//     // const rerender = useUpdate()
//     // const [tree, setTree] = useState<LayerTreeNode | null>(() => {
//     //   return pap?.currentDocument
//     //     ? convertLayerNodeToTreeViewNode(pap.currentDocument, root)
//     //     : null
//     // })

//     // const update = useCallback(() => {
//     //   // setTree(tree)
//     //   rerender()
//     // }, [])

//     // const handleClickItem = useEvent((item: LayerTreeNode) => {
//     //   if (item instanceof LayerTreeNode) {
//     //     pap!.setStrokingTargetLayer(item.nodePath)
//     //     rerender()
//     //   }
//     // })

//     // const handleDragStart = useEvent<TreeView.DragStartCallback<LayerTreeNode>>(
//     //   ({ item }) => {
//     //     // if (!item.node.selected) {
//     //     //   item.node.root.deselect()
//     //     //   item.node.select()
//     //     //   update()
//     //     // }
//     //     return true
//     //   },
//     // )

//     // const handleDrop = useEvent<TreeView.DropCallback<LayerTreeNode>>(
//     //   ({ item, draggedItem, before }) => {
//     //     console.log({ draggedItem, item, before })
//     //     // if (!draggedItem) return

//     //     // for (const node of item.node.root.selectedDescendants) {
//     //     //   item.insertBefore(node, before)
//     //     // }
//     //     // update()
//     //   },
//     // )

//     // const canDrop = useEvent<TreeView.CanDropCallback<LayerTreeNode>>(
//     //   ({ item, draggedItem }) => {
//     //     return !!draggedItem && item.canDroppable(draggedItem)
//     //   },
//     // )

//     // const updateTree = useStableLatestRef(() => {
//     //   if (!pap.currentDocument || !tree) return

//     //   updateLayerTree(pap!.currentDocument, root, tree)
//     // })

//     // const BindedLayerTreeRow = useMemo(() => {
//     //   return (props: TreeView.RowRenderProps<LayerTreeNode>) => {
//     //     return (
//     //       <LayerTreeRow
//     //         {...props}
//     //         size={size}
//     //         onClick={handleClickItem}
//     //         onChange={update}
//     //         onContextMenu={onLayerItemContextMenu}
//     //       />
//     //     )
//     //   }
//     // }, [size, handleClickItem, update])

//     // useEffect(() => {
//     //   const changed = () => {
//     //     updateTree.current()
//     //   }

//     //   pap!.on('documentChanged', changed)
//     //   pap!.on('activeLayerChanged', changed)
//     //   pap!.on('history:affect', changed)
//     //   return () => {
//     //     pap!.off('documentChanged', changed)
//     //     pap!.off('activeLayerChanged', changed)
//     //     pap!.off('history:affect', changed)
//     //   }
//     // }, [])

//     // if (!tree) return null

//     return (
//       <NewTreeView
//       // rootItem={tree}
//       // background={
//       //   <div
//       //     style={{
//       //       position: 'absolute',
//       //       inset: 0,
//       //     }}
//       //     // onClick={(e, item) => {
//       //     //   tree.node.deselect()
//       //     //   update()
//       //     // }}
//       //   />
//       // }
//       // canDrop={canDrop}
//       // onDragStart={handleDragStart}
//       // onDrop={handleDrop}
//       // dropBetweenIndicator={BetweenIndicator}
//       // dropOverIndicator={OverIndicator!}
//       // renderRow={BindedLayerTreeRow}
//       />
//     )
//   },
// )

// const BetweenIndicator = function BetweenIndicator({
//   top,
//   left,
// }: TreeView.DropBetweenIndicatorRenderProps) {
//   return (
//     <div
//       style={{
//         position: 'absolute',
//         top,
//         left,
//         width: '100%',
//         height: '1px',
//         background: 'var(--sky-8)',
//       }}
//     />
//   )
// }

// const OverIndicator = function OverIndicator({
//   top,
//   height,
// }: TreeView.DropOverIndicatorRenderProps) {
//   return (
//     <div
//       style={{
//         position: 'absolute',
//         top,
//         left: 0,
//         width: '100%',
//         height,
//         background: 'var(--sky-5)',
//         opacity: 0.5,
//       }}
//     />
//   )
// }

// const LayerTreeRow = ({
//   item,
//   depth,
//   size,
//   onChange,
//   onClick,
//   onContextMenu,
// }: TreeView.RowRenderProps<LayerTreeNode> & {
//   size: 'sm' | 'lg'
//   onChange: () => void
//   onClick: (item: LayerNodes) => void
//   onContextMenu: (entity: LayerContextMenuEvent) => void
// }) => {
//   const { pplc: pap } = usePaplicoInstance()
//   const papStore = useEngineStore(storePicker(['engineState']))

//   const handleCollapseButtonClick = useEvent((e: MouseEvent) => {
//     e.stopPropagation()
//     item.collapsed = !item.collapsed
//     onChange()
//   })

//   const handleClick = useEvent(() => {
//     onClick(item)
//   })

//   const handleContextMenu = useEvent((e: MouseEvent) => {
//     onContextMenu({ kind: 'layer', event: e, layerUid: item.layerNode.uid })
//   })

//   const layerImage = pap!.previews.getForLayer(item.key)

//   return (
//     <div
//       css={css`
//         display: flex;
//         align-items: center;
//         padding: 2px;
//         font-size: var(--font-size-2);
//         line-height: var(--line-height-2);

//         & + & {
//           border-top: 1px solid var(--gray-8);
//         }
//       `}
//       style={{
//         background:
//           item instanceof LayerTreeNode &&
//           pap?.activeLayer?.layerUid === item.layerNode.uid
//             ? 'var(--sky-5)'
//             : 'transparent',
//       }}
//       onClick={handleClick}
//       onContextMenu={handleContextMenu}>
//       <span
//         css={css`
//           display: inline-flex;
//           min-width: 16px;
//           align-items: center;
//           opacity: 0.5;

//           &:hover {
//             opacity: 1;
//           }
//         `}
//         style={{
//           marginRight: 2 + depth * 12,
//         }}
//         onClick={handleCollapseButtonClick}>
//         {item.hasChildren() &&
//           (item.collapsed ? <TriangleUpIcon /> : <TriangleDownIcon />)}
//       </span>

//       <img
//         css={css`
//           border: none;
//           /* border: 1px solid var(--gray-8); */
//         `}
//         src={layerImage?.url}
//         style={
//           size == 'sm'
//             ? {
//                 width: 16,
//                 marginRight: 4,
//                 aspectRatio: '1',
//               }
//             : {
//                 width: 32,
//                 marginRight: 8,
//                 aspectRatio: '1 / 1.6',
//               }
//         }
//         decoding="async"
//         loading="lazy"
//       />

//       {item instanceof LayerTreeNode
//         ? emptyCoalease(
//             item.layerNode.name,
//             <PlaceholderString>
//               {
//                 // prettier-ignore
//                 item.layerNode.layerType === 'vector'? '<Vector Layer>'
//                 : item.layerNode.layerType === 'text' ? '<Text Layer>'
//                 : '<Normal Layer>'
//               }
//             </PlaceholderString>,
//           )
//         : 'Vector Object'}
//     </div>
//   )
// }

const PlaceholderStringSpan = styled.span`
  color: var(--gray-10);
`

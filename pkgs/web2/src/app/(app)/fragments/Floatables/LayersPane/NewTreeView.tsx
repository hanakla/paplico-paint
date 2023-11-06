import { MouseEvent, memo, useEffect, useMemo, useState } from 'react'
import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  Modifier,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  LayerTreeNode,
  convertLayerNodeToTreeViewNode,
  getNextNodePath,
  mergeNextTree,
  updateTree,
} from './structs'
import { useEngineStore, usePaplicoInstance } from '@/domains/engine'
import useEvent from 'react-use-event-hook'
import { emptyCoalease } from '@/utils/lang'
import styled, { css } from 'styled-components'
import {
  ContextMenu,
  ContextMenuItemClickHandler,
  useContextMenu,
} from '@/components/ContextMenu'
import { Commands } from '@paplico/core-new'
import { TriangleDownIcon, TriangleUpIcon } from '@radix-ui/react-icons'
import {
  RxEyeNone,
  RxEyeOpen,
  RxLockClosed,
  RxLockOpen1,
  RxLockOpen2,
  RxTriangleDown,
  RxTriangleUp,
} from 'react-icons/rx'
import { usePropsMemo } from '@/utils/hooks'
import { GhostButton } from '@/components/GhostButton'
import { DisplayContents } from '@/components/DisplayContents'
import { createUseStore } from '@/utils/zustand'
import { StoreApi, createStore } from 'zustand/vanilla'

type LayerContextMenuEvent = {
  event: MouseEvent
  pathToVisu: string[]
}

type LayerContextMenuParams = {
  pathToVisu: string[]
}

type TreeViewProps = {
  mode: 'desktop' | 'mobile'
}

type Store = {
  set: StoreApi<Store>['setState']
  items: LayerTreeNode[]
  toggleDragging(item: string, dragging: boolean): void
  toggleVisible(item: string, visible: boolean): void
  toggleCollapse(item: string, collapsed: boolean): void
}

const useLayerTreeStore = createUseStore(
  createStore<Store>((set, get) => ({
    set,

    items: [],

    toggleDragging(visuUid: string, dragging: boolean) {
      set((prev) => ({
        items: updateTree(prev.items, visuUid, {
          dragging: true,
        }),
      }))
    },
    toggleVisible(visuUid: string, visible: boolean) {
      set((prev) => ({
        items: updateTree(prev.items, visuUid, {
          visible,
        }),
      }))
    },
    toggleCollapse(visuUid: string, collapsed: boolean) {
      set((prev) => ({
        items: updateTree(prev.items, visuUid, {
          childrenCollapsed: collapsed,
        }),
      }))
    },
  })),
)

export const NewTreeView = memo(function NewTreeView({
  mode = 'desktop',
}: TreeViewProps) {
  const { pplc } = usePaplicoInstance()
  const menu = useContextMenu<LayerContextMenuParams>()

  const treeStore = useLayerTreeStore()
  useMemo(() => {
    treeStore.set({
      items: pplc?.currentDocument
        ? convertLayerNodeToTreeViewNode(
            pplc.currentDocument,
            pplc.currentDocument.layerTreeRoot,
          )
        : [],
    })
  }, [pplc?.currentDocument?.uid])

  const [activeItem, setActiveItem] = useState<LayerTreeNode | null>(null)

  // const [items, setItems] = useState([1, 2, 3])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const handleItemContextMenu = useEvent((e: LayerContextMenuEvent) => {
    menu.show({
      event: e.event,
      props: {
        pathToVisu: e.pathToVisu,
      },
    })
  })

  const handleDragStart = useEvent((e: DragStartEvent) => {
    treeStore.toggleDragging(e.active.id as string, true)
  })

  const handleDragEnd = useEvent((e: DragEndEvent) => {
    const { active, over } = e

    treeStore.toggleDragging(e.active.id as string, true)

    console.log({ active, over })
    console.log(getNextNodePath(pplc!.currentDocument!, items, active, over))

    // if (active.id !== over.id) {
    //   setItems((items) => {
    //     const oldIndex = items.indexOf(active.id)
    //     const newIndex = items.indexOf(over.id)
    //     return arrayMove(items, oldIndex, newIndex)
    //   })
    // }
  })

  useEffect(() => {
    const changed = () => {
      console.log('change!')
      // if (!pplc?.currentDocument) {
      //   setItems([])
      //   return
      // }

      // setItems((items) => {
      //   return mergeNextTree(
      //     items,
      //     convertLayerNodeToTreeViewNode(
      //       pplc!.currentDocument!,
      //       pplc!.currentDocument!.layerTreeRoot,
      //     ),
      //   )
      // })
    }

    pplc!.on('documentChanged', changed)
    pplc!.on('strokingTargetChanged', changed)
    pplc!.on('history:affect', changed)
    return () => {
      pplc!.off('documentChanged', changed)
      pplc!.off('strokingTargetChanged', changed)
      pplc!.off('history:affect', changed)
    }
  }, [])

  if (treeStore.items.length === 0) {
    return null
  }

  return (
    <DisplayContents
      css={css`
        & > *:not(input) {
          user-select: none;
        }
      `}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={treeStore.items}
          strategy={verticalListSortingStrategy}
        >
          {treeStore.items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              item={item}
              mode={mode}
              onContextMenu={handleItemContextMenu}
            />
          ))}
        </SortableContext>

        <DragOverlay modifiers={[]}>
          {activeItem && (
            <SortableItem
              key={activeItem.id}
              id={activeItem.id}
              item={activeItem}
              mode={mode}
              onContextMenu={handleItemContextMenu}
            />
          )}
        </DragOverlay>
      </DndContext>
      <LayerItemContextMenu id={menu.id} />
    </DisplayContents>
  )
})

export const SortableItem = memo(function SortableItem({
  id,
  item,
  mode,
  onContextMenu,
}: {
  id: string
  item: LayerTreeNode
  mode: TreeViewProps['mode']
  onContextMenu: (e: LayerContextMenuEvent) => void
}) {
  const { pplc } = usePaplicoInstance()
  const { canvasEditor } = useEngineStore()
  const treeStore = useLayerTreeStore()
  const propsMemo = usePropsMemo()

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: id })

  const sortableStyle = propsMemo.memo(
    'sortable-style',
    () => ({ transform: CSS.Transform.toString(transform), transition }),
    [CSS.Transform.toString(transform), transition],
  )

  const handleClick = useEvent(() => {
    pplc!.setStrokingTarget(item.path)
  })

  const handleClickCollapse = useEvent((e: MouseEvent) => {
    e.stopPropagation()

    treeStore.toggleCollapse(item.visUid, !item.collapsed)
  })

  const handleClickToggleVisible = useEvent((e: MouseEvent) => {
    e.stopPropagation()

    treeStore.toggleVisible(item.visUid, !item.visu.visible)

    pplc!.command.do(
      new Commands.VisuUpdateAttributes(item.visUid, {
        updater: (attr) => {
          console.log('hi')
          attr.visible = !attr.visible
        },
      }),
    )
  })

  const handleContextMenu = useEvent((e: MouseEvent) => {
    onContextMenu({ event: e, pathToVisu: item.path })
  })

  const layerImage = pplc!.previews.getForLayer(item.visUid)

  if (item.collapsedByParent) {
    return null
  }

  return (
    <div
      ref={setNodeRef}
      css={css`
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px 8px;
        font-size: var(--font-size-2);
        line-height: var(--line-height-2);
        touch-action: none;
        user-select: none;

        & + & {
          border-top: 1px solid var(--slate-5);
        }
      `}
      style={propsMemo.memo(
        'rootStyle',
        () => ({
          ...sortableStyle,
          background:
            canvasEditor?.getStrokingTarget()?.visuUid === item.visUid
              ? 'var(--sky-5)'
              : 'transparent',
        }),
        [sortableStyle, canvasEditor?.getStrokingTarget()?.visuUid],
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <GhostButton
        css={s.layerControlIcon}
        onClick={handleClickToggleVisible}
        data-filter-uid={item.visUid}
        style={{
          opacity: item.invisibleByParent ? 0.3 : 1,
        }}
      >
        {item.visu.visible ? <RxEyeOpen size={12} /> : <RxEyeNone size={12} />}
      </GhostButton>

      <GhostButton
        css={s.layerControlIcon}
        onClick={handleClickToggleVisible}
        data-filter-uid={item.visUid}
      >
        {item.visu.lock ? (
          <RxLockClosed size={12} />
        ) : (
          <RxLockOpen2 size={12} />
        )}
      </GhostButton>

      <GhostButton
        css={css`
          position: relative;
          ${s.layerControlIcon}

          &:hover {
            opacity: 1;
          }
        `}
        style={{
          marginRight: 2 + item.depth * 12,
        }}
        onClick={handleClickCollapse}
        tabIndex={item.visu.type === 'group' ? undefined : -1}
      >
        {item.visu.type === 'group' ? (
          item.collapsed ? (
            <RxTriangleUp />
          ) : (
            <RxTriangleDown />
          )
        ) : (
          <>
            <div
              role="none"
              css={css`
                position: absolute;
                top: -4px;
                bottom: -4px;
                left: 50%;
                border-left: 0.5px solid var(--gray-10);
              `}
            />
            &zwnj;
          </>
        )}
      </GhostButton>

      <div
        css={css`
          display: flex;
          align-items: center;

          font-size: var(--font-size-2);
        `}
        // {...attributes}
        {...listeners}
      >
        <img
          css={css`
            border: none;
            vertical-align: bottom;
            line-height: 1;
            border: 0.5px solid var(--gray-8);
          `}
          src={layerImage?.url}
          style={
            mode == 'desktop'
              ? {
                  width: 16,
                  marginRight: 4,
                  aspectRatio: '1',
                  objectFit: 'contain',
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

        {
          // prettier-ignore
          emptyCoalease(
            item.visu.name,
            <PlaceholderString>
              {item.visu.type === 'group' ? '<Group Layer>'
              : item.visu.type === 'vectorObject'? '<Vector Layer>'
              : item.visu.type === 'text' ? '<Text Layer>'
              : '<Normal Layer>'}
            </PlaceholderString>
          )
        }
      </div>
    </div>
  )
})

const LayerItemContextMenu = memo<{ id: string }>(
  function LayerItemContextMenu({ id }) {
    const { pplc: pap } = usePaplicoInstance()

    const onClickRemove = useEvent<
      ContextMenuItemClickHandler<LayerContextMenuParams>
    >(({ props }) => {
      pap?.command.do(
        new Commands.DocumentUpdateLayerNodes({ remove: [props!.pathToVisu] }),
      )
    })

    return (
      <ContextMenu.Menu id={id}>
        <ContextMenu.Item onClick={onClickRemove}>Remove</ContextMenu.Item>
      </ContextMenu.Menu>
    )
  },
)

const s = {
  layerControlIcon: css`
    display: inline-flex;
    padding: 2px;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    line-height: 1;
  `,
}

const PlaceholderString = styled.span`
  color: var(--gray-10);
`

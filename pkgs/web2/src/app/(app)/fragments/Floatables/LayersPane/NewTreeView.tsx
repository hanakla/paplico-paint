import { MouseEvent, memo, useEffect, useMemo, useState } from 'react'
import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
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
  LayerTreeNode,
  convertLayerNodeToTreeViewNode,
  getMoveToNodePath,
  syncAndBuildNextTree,
  updateTree,
} from './structs'
import {
  useCanvasEditorState,
  usePaplicoInstance,
} from '@/domains/engine'
import useEvent from 'react-use-event-hook'
import styled, { css } from 'styled-components'
import {
  ContextMenu,
  ContextMenuItemClickHandler,
  useContextMenu,
} from '@/components/ContextMenu'
import { Commands, Document } from '@paplico/core-new'
import {
  RxEyeNone,
  RxEyeOpen,
  RxLockClosed,
  RxLockOpen2,
  RxTriangleDown,
  RxTriangleUp,
} from 'react-icons/rx'
import { useStateSync } from '@/utils/hooks'
import { GhostButton } from '@/components/GhostButton'
import { createUseStore } from '@/utils/zustand'
import { StoreApi, createStore } from 'zustand/vanilla'
import { clamp } from '@/utils/math'
import { emptyCoalease, pick } from '@paplico/shared-lib'
import { usePropsMemo } from '@paplico/shared-lib/react'
import { twx } from '@/utils/tailwind'

type LayerContextMenuEvent = {
  event: MouseEvent
  pathToVisu: string[]
}

type LayerContextMenuParams = {
  pathToVisu: string[]
}

type TreeViewProps = {
  mode: 'desktop' | 'mobile'
  className?: string
}

type Store = {
  set: StoreApi<Store>['setState']
  items: LayerTreeNode[]
  syncFromSource(doc: Document.PaplicoDocument): void
  toggleDragging(item: string, dragging: boolean): void
  toggleVisible(item: string, visible: boolean): void
  toggleCollapse(item: string, collapsed: boolean): void
}

const useLayerTreeStore = createUseStore(
  createStore<Store>((set, get) => ({
    set,

    items: [],

    syncFromSource(doc: Document.PaplicoDocument) {
      set((prev) => ({
        items: syncAndBuildNextTree(
          prev.items,
          convertLayerNodeToTreeViewNode(doc, doc.layerTreeRoot),
        ),
      }))
    },

    toggleDragging(visuUid: string, dragging: boolean) {
      set((prev) => ({
        items: updateTree(prev.items, visuUid, {
          dragging,
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
  className,
}: TreeViewProps) {
  const { pplc } = usePaplicoInstance()
  const menu = useContextMenu<LayerContextMenuParams>()

  const treeStore = useLayerTreeStore()
  useStateSync(() => {
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const modifiers = useMemo(() => [looseRestrictToParentElement], [])

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
    setActiveItem(treeStore.items[e.active.data.current!.sortable.index])
  })

  // const handleDragMove = useEvent((e: DragMoveEvent) => {
  //   e
  // })

  const handleDragEnd = useEvent((e: DragEndEvent) => {
    const { active, over, delta, collisions } = e

    console.log({ active, over, delta, collisions })

    setActiveItem(null)
    treeStore.toggleDragging(e.active.id as string, false)

    const moves = getMoveToNodePath(treeStore.items, active, over, delta.x)

    if (!moves) return

    const [sourcePath, overPath] = moves

    pplc?.command.do(
      new Commands.DocumentManipulateLayerNodes({
        move: [{ sourceNodePath: sourcePath, targetNodePath: overPath }],
      }),
    )

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
      if (!pplc?.currentDocument) {
        treeStore.set({ items: [] })
        return
      }

      treeStore.syncFromSource(pplc!.currentDocument!)
    }

    pplc!.on('documentChanged', changed)
    pplc!.on('strokingTargetChanged', changed)
    pplc!.on('finishRenderCompleted', changed)
    return () => {
      pplc!.off('documentChanged', changed)
      pplc!.off('strokingTargetChanged', changed)
      pplc!.off('finishRenderCompleted', changed)
    }
  }, [pplc, pplc?.currentDocument])

  if (treeStore.items.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={modifiers}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={treeStore.items}

          // strategy={verticalListSortingStrategy}
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

        <DragOverlay modifiers={modifiers}>
          {activeItem && (
            <SortableItem
              key={activeItem.id}
              id={activeItem.id}
              item={activeItem}
              mode={mode}
              onContextMenu={handleItemContextMenu}
              ghost
            />
          )}
        </DragOverlay>
      </DndContext>
      <LayerItemContextMenu id={menu.id} />
    </div>
  )
})

export const SortableItem = memo(function SortableItem({
  id,
  item,
  mode,
  onContextMenu,
  ghost,
}: {
  id: string
  item: LayerTreeNode
  mode: TreeViewProps['mode']
  onContextMenu: (e: LayerContextMenuEvent) => void
  ghost?: boolean
}) {
  const { pplc } = usePaplicoInstance()
  // const { canvasEditor } = initializeOnlyUseEngineStore()
  const { isSelected, strokingTarget, setSelectedVisuUids } =
    useCanvasEditorState((s) => ({
      isSelected: s.isInSelectedVisuUids(item.visUid),
      strokingTarget: s.getStrokingTarget(),
      ...pick(s, ['setSelectedVisuUids']),
    }))
  const treeStore = useLayerTreeStore()
  const propsMemo = usePropsMemo()

  const { attributes, listeners, setNodeRef, transform, transition, active } =
    useSortable({ id: id })

  const sortableStyle = propsMemo.memo(
    'sortable-style',
    () => ({ transform: CSS.Transform.toString(transform), transition }),
    [CSS.Transform.toString(transform), transition],
  )

  const handleClick = useEvent((e: MouseEvent<HTMLElement>) => {
    if (pplc?.currentDocument?.layerNodes.isDrawableNode(item.path)) {
      pplc!.setStrokingTarget(item.path)
    }

    setSelectedVisuUids?.((prev) => {
      if (e.ctrlKey || e.metaKey) {
        return prev.includes(item.visUid)
          ? prev.filter((uid) => uid !== item.visUid)
          : [...prev, item.visUid]
      } else {
        return [item.visUid]
      }
    })
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
          attr.visible = !attr.visible
        },
      }),
    )
  })

  const handleClickToggleLock = useEvent((e: MouseEvent) => {
    e.stopPropagation()

    pplc!.command.do(
      new Commands.VisuUpdateAttributes(item.visUid, {
        updater: (attr) => {
          attr.lock = !attr.lock
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
        font-size: var(--font-size-2);
        line-height: var(--line-height-2);
        touch-action: none;
        user-select: none;
        overflow: visible;
        border-style: solid;

        &:hover {
          background-color: var(--blue-a2);
        }

        & + & {
          border-top: 0.5px solid var(--slate-a5);
        }
      `}
      style={propsMemo.memo(
        'rootStyle',
        () => ({
          ...sortableStyle,
          background: isSelected ? 'var(--blue-5)' : undefined,
          borderWidth: strokingTarget?.visuUid === item.visUid ? 1 : 0,
          borderColor: 'var(--blue-8)',
          opacity: ghost ? 0.5 : undefined,
        }),
        [sortableStyle, isSelected, strokingTarget?.visuUid, ghost],
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      {...attributes}
      {...listeners}
    >
      {item.dragging && (
        <div
          css={css`
            height: 4px;
            background-color: var(--blue-9);
          `}
        >
          &zwnj;
        </div>
      )}

      <div
        className={twx('flex items-center gap-[2px] p-[2px_4px]')}
        style={{
          display: item.dragging ? 'none' : undefined,
        }}
      >

        <GhostButton
          css={css`
            ${s.layerControlButton}

            &:hover {
              opacity: 1;
            }
          `}
          style={{
            marginLeft: item.depth * 16,
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

          <span
            aria-label={
              // prettier-ignore
              item.visu.name + ' ' +
              (item.visu.type === 'group' ? 'Group Layer'
              : item.visu.type === 'vectorObject'? 'Vector Layer'
              : item.visu.type === 'text' ? 'Text Layer'
              : item.visu.type === 'canvas' ? 'Normal Layer'
              : 'Normal Layer')
            }
          >
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
          </span>

        </div>

        <GhostButton
          css={s.layerControlButton}
          onClick={handleClickToggleVisible}
          data-filter-uid={item.visUid}
          className="ml-auto"
          style={{
            opacity: item.invisibleByParent ? 0.3 : 1,
          }}
        >
          {item.visu.visible ? (
            <RxEyeOpen size={12} />
          ) : (
            <RxEyeNone size={12} />
          )}
        </GhostButton>

        <GhostButton
          css={s.layerControlButton}
          onClick={handleClickToggleLock}
          data-filter-uid={item.visUid}
          style={{
            opacity: item.lockByParent ? 0.3 : 1,
          }}
        >
          {item.visu.lock ? (
            <RxLockClosed size={12} />
          ) : (
            <RxLockOpen2 size={12} />
          )}
        </GhostButton>
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
        new Commands.DocumentManipulateLayerNodes({
          remove: [props!.pathToVisu],
        }),
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
  layerControlButton: css`
    position: relative;
    display: inline-flex;
    width: 16px;
    height: 16px;
    padding: 0;
    align-items: center;
    justify-content: center;
    vertical-align: bottom;
    line-height: 1;
    transition-property: transform;
    transition: 0.1s ease-out;

    &:hover {
      transform: scale(1.3);
    }
  `,
}

const PlaceholderString = styled.span`
  color: var(--gray-10);
`

function looseRestrictToBoundingRect(
  transform: Parameters<Modifier>[0]['transform'],
  rect: NonNullable<Parameters<Modifier>[0]['draggingNodeRect']>,
  boundingRect: NonNullable<Parameters<Modifier>[0]['containerNodeRect']>,
) {
  const value = { ...transform }

  // y is restricted to the bounding rect
  value.y = clamp(
    value.y,
    boundingRect.top - rect.top,
    boundingRect.top + boundingRect.height - rect.bottom,
  )

  value.x = clamp(
    value.x,
    boundingRect.left - rect.left - 100,
    boundingRect.left + boundingRect.width - rect.right + 100,
  )

  return value
}

const looseRestrictToParentElement: Modifier = (_ref) => {
  let { containerNodeRect, draggingNodeRect, transform } = _ref

  if (!draggingNodeRect || !containerNodeRect) {
    return transform
  }

  return looseRestrictToBoundingRect(
    transform,
    draggingNodeRect,
    containerNodeRect,
  )
}

import { MouseEvent, memo, useEffect, useState } from 'react'
import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DndContext,
  KeyboardSensor,
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
  mergeNextTree,
  updateTree,
} from './structs'
import { usePaplicoInstance } from '@/domains/paplico'
import useEvent from 'react-use-event-hook'
import { emptyCoalease } from '@/utils/lang'
import { css } from 'styled-components'
import {
  ContextMenu,
  ContextMenuItemClickHandler,
  useContextMenu,
} from '@/components/ContextMenu'
import { Commands } from '@paplico/core-new'
import { TriangleDownIcon, TriangleUpIcon } from '@radix-ui/react-icons'

type LayerContextMenuEvent = {
  event: MouseEvent
  pathToVisu: string[]
}

type LayerContextMenuParams = {
  pathToVisu: string[]
}

export const NewTreeView = memo(function NewTreeView() {
  const { pplc } = usePaplicoInstance()
  const menu = useContextMenu<LayerContextMenuParams>()

  // const rerender = useUpdate()
  const [items, setItems] = useState<LayerTreeNode[]>(() => {
    return pplc?.currentDocument
      ? convertLayerNodeToTreeViewNode(
          pplc.currentDocument,
          pplc.currentDocument.layerTreeRoot,
        )
      : []
  })

  // const [items, setItems] = useState([1, 2, 3])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleCollapse = useEvent((item: LayerTreeNode) => {
    setItems((items) =>
      updateTree(items, item.visUid, {
        childrenCollapsed: !item.childrenCollapsed,
      }),
    )
  })

  const handleItemContextMenu = useEvent((e: LayerContextMenuEvent) => {
    menu.show({
      event: e.event,
      props: {
        pathToVisu: e.pathToVisu,
      },
    })
  })

  const handleDragEnd = useEvent((event) => {
    const { active, over } = event

    console.log(event)
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
        setItems([])
        return
      }

      setItems((items) => {
        return mergeNextTree(
          items,
          convertLayerNodeToTreeViewNode(
            pplc!.currentDocument!,
            pplc!.currentDocument!.layerTreeRoot,
          ),
        )
      })
    }

    pplc!.on('documentChanged', changed)
    pplc!.on('activeLayerChanged', changed)
    pplc!.on('history:affect', changed)
    return () => {
      pplc!.off('documentChanged', changed)
      pplc!.off('activeLayerChanged', changed)
      pplc!.off('history:affect', changed)
    }
  }, [])

  if (!items) {
    return
  }

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}>
        <SortableContext
          items={items}
          // strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              item={item}
              onCollapse={handleCollapse}
              onContextMenu={handleItemContextMenu}
            />
          ))}
        </SortableContext>
      </DndContext>
      <LayerItemContextMenu id={menu.id} />
    </div>
  )
})

export const SortableItem = memo(function SortableItem({
  id,
  item,
  onCollapse,
  onContextMenu,
}: {
  id: string
  item: LayerTreeNode
  onCollapse: (item: LayerTreeNode) => void
  onContextMenu: (e: LayerContextMenuEvent) => void
}) {
  const { pplc } = usePaplicoInstance()

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleClick = useEvent(() => {
    pplc!.setStrokingTargetLayer(item.path)
  })

  const handleCollapseButtonClick = useEvent((e) => {
    onCollapse(item)
  })

  const handleContextMenu = useEvent((e: MouseEvent) => {
    onContextMenu({ event: e, pathToVisu: item.path })
  })

  if (item.collapsed) {
    return null
  }

  return (
    <div
      ref={setNodeRef}
      css={css`
        display: flex;
        align-items: center;
        padding: 2px;
        font-size: var(--font-size-2);
        line-height: var(--line-height-2);
        touch-action: none;

        & + & {
          border-top: 1px solid var(--gray-5);
        }
      `}
      style={style}
      // style={
      //   {
      //     // background:
      //     //   item instanceof LayerTreeNode &&
      //     //   pap?.activeLayer?.layerUid === item.layerNode.uid
      //     //     ? 'var(--sky-5)'
      //     //     : 'transparent',
      //   }
      // }

      onClick={handleClick}
      onContextMenu={handleContextMenu}>
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
          marginRight: 2 + item.depth * 12,
        }}
        onClick={handleCollapseButtonClick}>
        {item.vis.type === 'group' &&
          (item.childrenCollapsed ? <TriangleUpIcon /> : <TriangleDownIcon />)}
      </span>
      <div {...attributes} {...listeners}>
        <img
          css={css`
            border: none;
            /* border: 1px solid var(--gray-8); */
          `}
          // src={layerImage?.url}
          style={
            {}
            // size == 'sm'
            //   ? {
            //       width: 16,
            //       marginRight: 4,
            //       aspectRatio: '1',
            //     }
            //   : {
            //       width: 32,
            //       marginRight: 8,
            //       aspectRatio: '1 / 1.6',
            //     }
          }
          decoding="async"
          loading="lazy"
        />

        {
          // prettier-ignore
          emptyCoalease(
            item.vis.name,
            item.vis.type === 'group' ? '<Group Layer>'
            : item.vis.type === 'vectorObject'? '<Vector Layer>'
            : item.vis.type === 'text' ? '<Text Layer>'
            : '<Normal Layer>'
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
      pap?.command.do(new Commands.DocumentRemoveLayerNode([props!.pathToVisu]))
    })

    return (
      <ContextMenu.Menu id={id}>
        <ContextMenu.Item onClick={onClickRemove}>Remove</ContextMenu.Item>
      </ContextMenu.Menu>
    )
  },
)

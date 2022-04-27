import { Add, ArrowDownS } from '@styled-icons/remix-line'
import { Eye, EyeClose } from '@styled-icons/remix-fill'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { memo, MouseEvent } from 'react'
import { useClickAway, useToggle } from 'react-use'
import { useTheme } from 'styled-components'
import { css } from 'styled-components'
import { SilkCommands, SilkDOM } from 'silk-core'
import { offset, shift, useFloating } from '@floating-ui/react-dom'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { useFleurContext, useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { CSS } from '@dnd-kit/utilities'

import {
  ContextMenu,
  ContextMenuItem,
  useContextMenu,
} from '🙌/components/ContextMenu'
import { Portal } from '🙌/components/Portal'
import { DOMUtils } from '🙌/utils/dom'
import { centering } from '🙌/utils/mixins'
import { FilterSettings } from './FilterSettings'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { isEventIgnoringTarget } from '../helpers'
import { SidebarPane } from '🙌/components/SidebarPane'
import { useFleur } from '🙌/utils/hooks'
import { useLayerWatch } from '../hooks'

export const FilterView = memo(() => {
  const { t } = useTranslation('app')

  const { executeOperation, getStore } = useFleurContext()
  const { activeLayer, activeLayerPath, registeredFilters } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      registeredFilters: EditorSelector.getAvailableFilters(get),
    })
  )

  useLayerWatch(activeLayer)

  const [listOpened, toggleListOpened] = useToggle(false)
  const listfl = useFloating({
    placement: 'bottom-end',
    strategy: 'fixed',
    middleware: [shift(), offset(4)],
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleClickOpenFilter = useFunk((e: MouseEvent<SVGElement>) => {
    toggleListOpened()
  })

  const handleClickAddFilter = useFunk(
    ({ currentTarget }: MouseEvent<HTMLLIElement>) => {
      toggleListOpened(false)

      if (!activeLayerPath) return

      const filterId = currentTarget.dataset.filterId!
      const filter = EditorSelector.getFilterInstance(getStore, filterId)
      if (!filter) return

      executeOperation(
        EditorOps.runCommand,
        new SilkCommands.Layer.AddFilter({
          pathToTargetLayer: activeLayerPath,
          filter: SilkDOM.Filter.create({
            filterId,
            settings: filter.initialConfig,
          }),
        })
      )
    }
  )

  const handleFilterSortEnd = useFunk(({ active, over }: DragEndEvent) => {
    if (!activeLayer || !activeLayerPath || !over) return

    const oldIndex = activeLayer.filters.findIndex((f) => f.uid === active.id)
    const newIndex = activeLayer.filters.findIndex((f) => f.uid === over.id)
    if (oldIndex === newIndex) return

    executeOperation(
      EditorOps.runCommand,
      new SilkCommands.Layer.ReorderFilter({
        pathToTargetLayer: activeLayerPath,
        filterUid: active.id,
        newIndex: { exactly: newIndex },
      })
    )
  })

  useClickAway(listfl.refs.floating, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    toggleListOpened(false)
  })

  return (
    <SidebarPane
      heading={
        <>
          {t('layerFilter')}

          <div
            ref={listfl.reference}
            css={`
              position: relative;
              margin-left: auto;
            `}
          >
            <Add width={16} onClick={handleClickOpenFilter} />

            <Portal>
              <ul
                ref={listfl.floating}
                css={css`
                  position: fixed;
                  z-index: 1;
                  width: 184px;
                  background-color: ${({ theme }) => theme.surface.popupMenu};
                  color: ${({ theme }) => theme.text.white};
                  box-shadow: 0 0 4px ${rgba('#000', 0.5)};
                  border-radius: 4px;

                  li {
                    padding: 8px;
                    user-select: none;
                  }
                  li:hover {
                    background-color: rgba(255, 255, 255, 0.2);
                  }
                `}
                style={{
                  position: listfl.strategy,
                  left: listfl.x ?? 0,
                  top: listfl.y ?? 0,
                  ...(listOpened
                    ? { visibility: 'visible', pointerEvents: 'all' }
                    : { visibility: 'hidden', pointerEvents: 'none' }),
                }}
              >
                {registeredFilters.map((filter) => (
                  <li
                    key={filter.id}
                    onClick={handleClickAddFilter}
                    data-filter-id={filter.id}
                  >
                    {t(`filters.${filter.id}`)}
                  </li>
                ))}
              </ul>
            </Portal>
          </div>
        </>
      }
      container={(children) => children}
    >
      {activeLayer && (
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleFilterSortEnd}
          sensors={sensors}
        >
          <SortableContext
            items={activeLayer.filters.map(({ uid }) => uid)}
            strategy={verticalListSortingStrategy}
          >
            {activeLayer.filters.map((filter) => (
              <FilterItem layer={activeLayer} filter={filter} />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </SidebarPane>
  )
})

const FilterItem = memo(function FilterItem({
  layer,
  filter,
}: {
  layer: SilkDOM.LayerTypes
  filter: SilkDOM.Filter
}) {
  const { t } = useTranslation('app')
  const theme = useTheme()
  const { execute } = useFleur()

  const contextMenu = useContextMenu()
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: filter.uid })

  const { activeLayer, activeLayerPath, selectedFilterIds } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      selectedFilterIds: get(EditorStore).state.selectedFilterIds,
    })
  )

  const active = selectedFilterIds[filter.uid]
  const [propsOpened, togglePropsOpened] = useToggle(false)

  const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return

    execute(EditorOps.setSelectedFilterIds, { [filter.uid]: true })
  })

  const handleDoubleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return
    togglePropsOpened()
  })

  const handleToggleVisibility = useFunk(() => {
    if (!activeLayer || !activeLayerPath) return

    execute(EditorOps.updateLayer, activeLayerPath, (layer) => {
      const targetFilter = layer.filters.find((f) => f.uid === filter.uid)
      if (!targetFilter) return

      targetFilter.visible = !targetFilter.visible
    })

    execute(EditorOps.rerenderCanvas)
  })

  const handleClickRemove = useFunk(() => {
    if (!activeLayer || !activeLayerPath) return

    execute(EditorOps.updateLayer, activeLayerPath, (layer) => {
      const idx = layer.filters.findIndex((f) => f.uid === filter.uid)
      if (idx === -1) return

      layer.filters.splice(idx, 1)
    })

    execute(EditorOps.rerenderCanvas)
  })

  return (
    <div
      ref={setNodeRef}
      css={css`
        display: flex;
        flex-wrap: wrap;
        color: ${({ theme }) => theme.text.white};
      `}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
      {...attributes}
      {...listeners}
    >
      <div
        css={`
          display: flex;
          flex: 1;
          padding: 4px;
        `}
        style={{
          backgroundColor: active ? theme.surface.sidebarListActive : undefined,
        }}
      >
        <div
          css={`
            ${centering}
            flex: none;
            width: 12px;
          `}
          data-ignore-click
        >
          <ArrowDownS
            css={`
              width: 12px;
            `}
            style={{
              transform: propsOpened ? 'rotateZ(180deg)' : 'rotateZ(0)',
            }}
            onClick={togglePropsOpened}
          />
        </div>

        <div
          css={`
            ${centering()}
            padding: 4px;
          `}
          style={{
            ...(filter.visible ? {} : { opacity: 0.5 }),
          }}
          onClick={handleToggleVisibility}
          data-ignore-click
        >
          {filter.visible ? (
            <Eye
              css={css`
                width: 16px;
                vertical-align: bottom;
                color: ${({ theme }) => theme.colors.white10};
              `}
            />
          ) : (
            <EyeClose
              css={`
                width: 16px;
                vertical-align: bottom;
              `}
            />
          )}
        </div>

        <div
          css={`
            ${centering()}
          `}
        >
          {t(`filters.${filter.filterId}`)}
        </div>
      </div>

      <div
        css={`
          flex-basis: 100%;
        `}
      />

      {propsOpened && (
        <div
          css={`
            padding: 8px;
            padding-left: 24px;
          `}
          data-ignore-click
        >
          <FilterSettings layer={layer} filter={filter}></FilterSettings>
        </div>
      )}

      <ContextMenu id={contextMenu.id}>
        <ContextMenuItem onClick={handleClickRemove}>
          {t('remove')}
        </ContextMenuItem>
      </ContextMenu>
    </div>
  )
})

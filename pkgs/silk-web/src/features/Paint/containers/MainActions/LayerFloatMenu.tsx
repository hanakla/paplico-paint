import type {} from '🙌/utils/styled-theme'

import {
  Add,
  DeleteBin,
  Eye,
  EyeClose,
  Menu,
  Magic,
  ArrowDownS,
} from '@styled-icons/remix-line'
import { Magic as MagicFill } from '@styled-icons/remix-fill'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { ChangeEvent, forwardRef, memo, MouseEvent, useRef } from 'react'
import { css, useTheme } from 'styled-components'
import { SilkCommands, SilkDOM } from 'silk-core'
import { useStore } from '@fleur/react'
import { useFunk, useObjectState } from '@hanakla/arma'
import { CSS } from '@dnd-kit/utilities'
import { useClickAway, useToggle } from 'react-use'
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

import { Portal } from '🙌/components/Portal'
import { centering, checkerBoard, rangeThumb } from '🙌/utils/mixins'
import { SelectBox } from '🙌/components/SelectBox'
import { FakeInput } from '🙌/components/FakeInput'
import {
  ActionSheet,
  ActionSheetItem,
  ActionSheetItemGroup,
} from '🙌/components/ActionSheet'
import { DOMUtils } from '🙌/utils/dom'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFleur } from '🙌/utils/hooks'
import { Checkbox } from '🙌/components/Checkbox'
import { shallowEquals } from '🙌/utils/object'
import { tm } from '🙌/utils/theme'
import { FilterSettings } from '../FilterSettings'
import { calcLayerMove, FlatLayerEntry, flattenLayers } from '../../helpers'
import {
  useActiveLayerPane,
  useDocumentWatch,
  useLayerWatch,
} from '../../hooks'

export const LayerFloatMenu = memo(
  forwardRef<HTMLDivElement, {}>(function LayerFloatMenu(_, ref) {
    const { t } = useTranslation('app')

    const { execute } = useFleur()
    const { currentDocument, layers, activeLayer, activeLayerPath } = useStore(
      (get) => ({
        currentDocument: EditorSelector.currentDocument(get),
        layers: EditorSelector.layers(get),
        activeLayer: EditorSelector.activeLayer(get),
        activeLayerPath: EditorSelector.activeLayerPath(get),
      })
    )
    useDocumentWatch(currentDocument)

    const [addLayerSheetOpened, toggleAddLayerSheetOpened] = useToggle(false)

    const handleLayerDragEnd = useFunk(({ active, over }: DragEndEvent) => {
      const moves = calcLayerMove(flatLayers, { active, over })
      if (!moves) return

      execute(
        EditorOps.runCommand,
        new SilkCommands.Layer.MoveLayer({
          sourcePath: moves.sourcePath,
          targetGroupPath: moves.targetParentPath,
          targetIndex: moves.targetIndex,
        })
      )
    })

    const handleClickAddLayer = useFunk(() => {
      toggleAddLayerSheetOpened(true)
    })

    const handleClickAddLayerItem = useFunk(
      ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
        if (!currentDocument) return

        const layerType = currentTarget.dataset
          .layerType! as SilkDOM.LayerTypes['layerType']
        const { width, height } = currentDocument

        let layer: SilkDOM.LayerTypes
        switch (layerType) {
          case 'raster': {
            layer = SilkDOM.RasterLayer.create({ width, height })
            break
          }
          case 'vector': {
            layer = SilkDOM.VectorLayer.create({})
            break
          }
          case 'filter': {
            layer = SilkDOM.FilterLayer.create({})
            break
          }
          default:
            throw new Error('なんかおかしなっとるで')
        }

        execute(EditorOps.addLayer, layer, {
          aboveLayerId: activeLayer?.uid ?? null,
        })
        toggleAddLayerSheetOpened(false)
      }
    )

    const addLayerSheetRef = useRef<HTMLDivElement | null>(null)
    const handleCloseAddLayerSheet = useFunk(() => {
      toggleAddLayerSheetOpened(false)
    })

    useClickAway(addLayerSheetRef, (e) => {
      // Reduce rerendering
      if (addLayerSheetOpened) toggleAddLayerSheetOpened(false)
    })

    const [collapsed, setCollapsed] = useObjectState<Record<string, boolean>>(
      {}
    )
    const flatLayers = flattenLayers(layers, (entry) => {
      return (
        entry.parentId == null ||
        (entry.parentId != null && !(collapsed[entry.parentId] ?? true))
      )
    })

    return (
      <div
        ref={ref}
        css={`
          padding: 8px 4px;
        `}
      >
        <div
          css={`
            display: grid;
            gap: 4px;
            max-height: 50vh;
            overflow: auto;
          `}
        >
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleLayerDragEnd}
          >
            <SortableContext
              items={flatLayers.map((entry) => entry.id)}
              strategy={verticalListSortingStrategy}
            >
              {flatLayers.map((entry) => (
                <SortableLayerItem
                  key={entry.id}
                  entry={entry}
                  childrenOpened={collapsed[entry.id] === false}
                  onToggleCollapse={(id) =>
                    setCollapsed((state) => {
                      state[id] = !(state[id] ?? true)
                      console.log(state, id)
                    })
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div
          css={`
            padding: 4px 0;
            flex: 1;
            text-align: center;
          `}
          onClick={handleClickAddLayer}
        >
          <Add
            css={`
              width: 24px;
              padding-bottom: 2px;
            `}
          />
          レイヤーを追加
        </div>

        <Portal>
          <ActionSheet
            ref={addLayerSheetRef}
            opened={addLayerSheetOpened}
            fill={false}
            onClose={handleCloseAddLayerSheet}
          >
            <div
              css={`
                padding-top: 16px;

                div + div {
                  border-top: 1px solid ${rgba('#000', 0.2)};
                }
              `}
            >
              <ActionSheetItemGroup>
                <div onClick={handleClickAddLayerItem} data-layer-type="raster">
                  <ActionSheetItem>{t('layerType.raster')}</ActionSheetItem>
                </div>
                <div onClick={handleClickAddLayerItem} data-layer-type="vector">
                  <ActionSheetItem>{t('layerType.vector')}</ActionSheetItem>
                </div>
                <div onClick={handleClickAddLayerItem} data-layer-type="filter">
                  <ActionSheetItem>{t('layerType.filter')}</ActionSheetItem>
                </div>
              </ActionSheetItemGroup>

              <ActionSheetItemGroup>
                <div
                  css={`
                    font-weight: bold;
                  `}
                  onClick={handleCloseAddLayerSheet}
                >
                  <ActionSheetItem>{t('cancel')}</ActionSheetItem>
                </div>
              </ActionSheetItemGroup>
            </div>
          </ActionSheet>
        </Portal>

        <div
          css={`
            display: flex;
          `}
        >
          <ActiveLayerPane />
        </div>
      </div>
    )
  })
)

const SortableLayerItem = memo(
  function LayerFloatItem({
    entry,
    childrenOpened,
    onToggleCollapse,
  }: {
    entry: FlatLayerEntry
    childrenOpened: boolean
    onToggleCollapse: (id: string) => void
  }) {
    if (entry.type !== 'layer') return null
    const { layer, parentPath, depth } = entry
    useLayerWatch(layer)

    const { t } = useTranslation('app')
    const theme = useTheme()
    const { execute } = useFleur()

    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: layer.uid })

    const {
      activeLayer,
      activeLayerPath,
      thumbnailUrlOfLayer,
      selectedLayerUids,
    } = useStore((get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
      selectedLayerUids: EditorSelector.selectedLayerUids(get),
    }))

    const [filtersSheetOpened, setFiltersSheetOpen] = useToggle(false)

    const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.closestOrSelf(e.target, '[data-dont-close-layer-float]'))
        return

      execute(EditorOps.setActiveLayer, [...parentPath, layer.uid])
    })

    const handleClickToggleVisible = useFunk((e: MouseEvent) => {
      if (!activeLayerPath) return

      execute(
        EditorOps.runCommand,
        new SilkCommands.Layer.PatchLayerAttr({
          pathToTargetLayer: activeLayerPath,
          patch: { visible: !layer.visible },
        })
      )
    })

    const handleClickLayerConfig = useFunk((e: MouseEvent) => {
      e.stopPropagation()
      setFiltersSheetOpen()
    })

    const handleClickLayerCheckBox = useFunk(
      (e: ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        e.stopPropagation()

        execute(EditorOps.setLayerSelection, (uids) => {
          if (e.currentTarget.checked) {
            return [...uids, layer.uid]
          } else {
            return uids.filter((uid) => uid !== layer.uid)
          }
        })
      }
    )

    const handleClickCollapseChildren = useFunk(() => {
      onToggleCollapse(entry.id)
    })

    const handleCloseFilterSheet = useFunk(() => {
      setFiltersSheetOpen(false)
    })

    return (
      <div
        ref={setNodeRef}
        css={css`
          display: flex;
          gap: 4px;
          width: 100%;
          padding: 4px 8px;
          user-select: none;
        `}
        style={{
          backgroundColor:
            activeLayer?.uid === layer.uid
              ? theme.colors.blueFade40
              : 'transparent',
          paddingLeft: 8 + depth * 8,
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        onClick={handleClick}
      >
        <div
          css={`
            ${centering()}
            flex: none;
            width: 16px;
          `}
        >
          {(layer.layerType === 'vector' || layer.layerType === 'group') && (
            <ArrowDownS
              width={16}
              style={{
                transform: childrenOpened ? 'rotateZ(180deg)' : 'rotateZ(0)',
              }}
              onClick={handleClickCollapseChildren}
            />
          )}
        </div>
        <label
          css={`
            ${centering()}
            padding: 0 4px;
          `}
          onClick={DOMUtils.stopPropagationHandler}
        >
          <Checkbox
            checked={selectedLayerUids.includes(layer.uid)}
            onClick={DOMUtils.stopPropagationHandler}
            onChange={handleClickLayerCheckBox}
          />
        </label>
        <img
          css={`
            width: 32px;
            height: 32px;
            ${checkerBoard({ size: 8 })}
          `}
          src={thumbnailUrlOfLayer(layer.uid)}
        />
        <div
          css={`
            display: flex;
            justify-content: center;
            padding: 0 4px;
          `}
          onClick={handleClickToggleVisible}
        >
          {layer.visible ? <Eye width={20} /> : <EyeClose width={20} />}
        </div>
        <div
          css={`
            display: flex;
            flex-flow: column;
            flex: 1;
            overflow: hidden;
          `}
        >
          <FakeInput
            css={`
              margin-bottom: 4px;
              padding: 0;
              pointer-events: none;
              background: none;
            `}
            value={layer.name}
            placeholder={`<${t(`layerType.${layer.layerType}`)}>`}
            disabled
          />
          <div
            css={`
              display: flex;
              gap: 4px;
              ${tm((o) => [o.font.text2])}
            `}
          >
            <span>{t(`compositeModes.${layer.compositeMode}`)}</span>
            <span>{Math.round(layer.opacity)}%</span>
          </div>
        </div>

        <div
          css={`
            ${centering()}
            padding: 0 2px;
          `}
          onClick={handleClickLayerConfig}
          data-dont-close-layer-float
        >
          {layer.filters.length > 0 ? (
            <MagicFill width={20} />
          ) : (
            <Magic width={20} />
          )}
        </div>

        <div
          css={`
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0 2px;
          `}
          data-dont-close-layer-float
          {...attributes}
          {...listeners}
        >
          <Menu
            width={16}
            css={`
              ${tm((o) => [o.font.text3])}
            `}
          />
        </div>

        <Portal>
          <FiltersSheet
            opened={filtersSheetOpened}
            layer={layer}
            onClose={handleCloseFilterSheet}
          />
        </Portal>
      </div>
    )
  },
  (prev, next) => shallowEquals(prev.entry, next.entry)
)

const FiltersSheet = memo(function FiltersSheet({
  opened,
  layer,
  onClose,
}: {
  opened: boolean
  layer: SilkDOM.LayerTypes
  onClose: () => void
}) {
  useLayerWatch(layer)

  const { t } = useTranslation('app')
  const { execute, getStore } = useFleur()
  const {
    activeLayer,
    activeLayerPath,
    thumbnailUrlOfLayer,
    registeredFilters,
  } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    activeLayerPath: EditorSelector.activeLayerPath(get),
    thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
    registeredFilters: EditorSelector.getAvailableFilters(get),
  }))

  const rootRef = useRef<HTMLDivElement | null>(null)
  const [addFilterSheetOpened, toggleAddFilterSheet] = useToggle(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const handleFilterSortEnd = useFunk(({ active, over }: DragEndEvent) => {
    if (!activeLayer || !activeLayerPath || !over) return

    const oldIndex = activeLayer.filters.findIndex((f) => f.uid === active.id)
    const newIndex = activeLayer.filters.findIndex((f) => f.uid === over.id)
    if (oldIndex === newIndex) return

    execute(
      EditorOps.runCommand,
      new SilkCommands.Layer.ReorderFilter({
        pathToTargetLayer: activeLayerPath,
        filterUid: active.id,
        newIndex: { exactly: newIndex },
      })
    )
  })

  const handleClickAddFilterButton = useFunk(() => {
    toggleAddFilterSheet(true)
  })

  const handleCloseAddFilterSheet = useFunk(() => {
    toggleAddFilterSheet(false)
  })

  const handleClickAddFilter = useFunk(
    ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
      toggleAddFilterSheet(false)

      if (!activeLayerPath) return

      const filterId = currentTarget.dataset.filterId!
      const filter = EditorSelector.getFilterInstance(getStore, filterId)
      if (!filter) return

      execute(
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

  const handleCloseFilterSheet = useFunk(() => {
    onClose()
  })

  useClickAway(rootRef, () => {
    onClose()
  })

  return (
    <ActionSheet
      ref={rootRef}
      opened={opened}
      onClose={handleCloseFilterSheet}
      fill
    >
      <div data-dont-close-layer-float>
        <div
          css={`
            margin-bottom: 24px;
          `}
        >
          <span
            css={`
              max-width: 100px;
              white-space: nowrap;
              text-overflow: ellipsis;
            `}
          >
            {t('filter')}
          </span>
        </div>
        <header
          css={css`
            display: flex;
            gap: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid
              ${({ theme }) => theme.exactColors.blackFade30};
          `}
        >
          <img
            css={`
              background: linear-gradient(
                  45deg,
                  rgba(0, 0, 0, 0.2) 25%,
                  transparent 25%,
                  transparent 75%,
                  rgba(0, 0, 0, 0.2) 75%
                ),
                linear-gradient(
                  45deg,
                  rgba(0, 0, 0, 0.2) 25%,
                  transparent 25%,
                  transparent 75%,
                  rgba(0, 0, 0, 0.2) 75%
                );
              background-size: 8px 8px;
              background-position: 0 0, 4px 4px;
              width: 32px;
              height: 32px;
            `}
            src={thumbnailUrlOfLayer(layer.uid)}
          />
          <div
            css={`
              display: flex;
              flex-flow: column;
              flex: 1;
              overflow: hidden;
            `}
          >
            <div
              css={`
                max-width: 100%;
                white-space: nowrap;
              `}
            >
              <span
                css={`
                  display: inline-block;
                  margin-right: 8px;
                  font-weight: bold;
                `}
              >
                {t('filter')}
              </span>
              {layer.name === ''
                ? `<${t(`layerType.${layer.layerType}`)}>`
                : layer.name}
            </div>
            <div css="display: flex; gap: 4px;">
              <span>{t(`compositeModes.${layer.compositeMode}`)}</span>
              <span>{Math.round(layer.opacity)}%</span>
            </div>
          </div>
        </header>

        <div
          css={`
            display: flex;
            flex-flow: column;
          `}
        >
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleFilterSortEnd}
            sensors={sensors}
          >
            <SortableContext
              items={layer.filters.map((entry) => entry.uid)}
              strategy={verticalListSortingStrategy}
            >
              {layer.filters.map((filter) => (
                <SortableFilterItem
                  key={filter.uid}
                  layer={layer}
                  filter={filter}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div
          css={`
            padding: 4px 0;
            flex: 1;
            text-align: center;
          `}
          onClick={handleClickAddFilterButton}
        >
          <Add
            css={`
              width: 24px;
              margin-top: auto;
              padding-bottom: 2px;
            `}
          />
          フィルターを追加
        </div>
      </div>

      <ActionSheet
        opened={addFilterSheetOpened}
        onClose={handleCloseAddFilterSheet}
        fill={false}
      >
        <div
          css={`
            padding-top: 40px;
          `}
          data-dont-close-layer-float
        >
          <ActionSheetItemGroup>
            {registeredFilters.map((filter) => (
              <ActionSheetItem
                key={filter.id}
                onClick={handleClickAddFilter}
                data-filter-id={filter.id}
              >
                {t(`filters.${filter.id}`)}
              </ActionSheetItem>
            ))}
          </ActionSheetItemGroup>
        </div>
      </ActionSheet>
    </ActionSheet>
  )
})

const SortableFilterItem = ({
  layer,
  filter,
}: {
  layer: SilkDOM.LayerTypes
  filter: SilkDOM.Filter
}) => {
  const { t } = useTranslation('app')

  const { execute } = useFleur()
  const { activeLayerPath, selectedFilterIds } = useStore((get) => ({
    activeLayerPath: EditorSelector.activeLayerPath(get),
    selectedFilterIds: get(EditorStore).state.selectedFilterIds,
  }))
  const selected = selectedFilterIds[filter.uid]

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: filter.uid })

  const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return

    execute(EditorOps.setSelectedFilterIds, { [filter.uid]: true })
  })

  const handleToggleVisibility = useFunk(() => {
    execute(EditorOps.updateLayer, [layer.uid], (layer) => {
      const targetFilter = layer.filters.find((f) => f.uid === filter.uid)
      if (!targetFilter) return

      targetFilter.visible = !targetFilter.visible
    })

    execute(EditorOps.rerenderCanvas)
  })

  const handleClickRemoveFilter = useFunk(() => {
    if (!activeLayerPath) return

    execute(
      EditorOps.runCommand,
      new SilkCommands.Layer.RemoveFilter({
        pathToTargetLayer: activeLayerPath,
        filterUid: filter.uid,
      })
    )
  })

  return (
    <div
      ref={setNodeRef}
      css={`
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        padding: 8px 0;
        padding-right: 8px;

        & + & {
          border-top: 1px solid ${rgba('#000', 0.1)};
        }
      `}
      onClick={handleClick}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div
        css={`
          ${centering()}
        `}
        onClick={handleToggleVisibility}
        data-ignore-click
      >
        {filter.visible ? (
          <Eye
            css={`
              width: 20px;
              vertical-align: bottom;
            `}
          />
        ) : (
          <EyeClose
            css={`
              width: 20px;
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

      <div
        css={`
          ${centering()}
          margin-left: auto;
        `}
        onClick={handleClickRemoveFilter}
      >
        <DeleteBin width={16} />
      </div>

      <div
        css={`
          ${centering()}
        `}
        {...listeners}
        {...attributes}
      >
        <Menu width={16} />
      </div>

      {selected && (
        <div
          css={`
            flex-basis: 100%;
            padding-left: 24px;
          `}
        >
          <FilterSettings layer={layer} filter={filter}></FilterSettings>
        </div>
      )}
    </div>
  )
}

const ActiveLayerPane = memo(function ActiveLayerPane() {
  const { t } = useTranslation('app')

  const {
    state: { activeLayer, layerName },
    handleChangeLayerName,
    handleChangeCompositeMode,
    handleChangeOpacity,
    handleClickRemoveLayer,
  } = useActiveLayerPane()

  return (
    <div
      css={`
        display: flex;
        flex-flow: column;
        gap: 2px;
        width: 100%;
        margin-top: 4px;
        padding: 4px;
        border-top: 1px solid ${rgba('#000', 0.2)};

        > div {
          padding: 2px 0;
        }
      `}
    >
      <div
        css={`
          display: flex;
        `}
      >
        <FakeInput
          placeholder={
            activeLayer
              ? `<${t(`layerType.${activeLayer.layerType}`)}>`
              : '<未選択>'
          }
          value={layerName}
          onChange={handleChangeLayerName}
        />
        <div
          css={`
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 4px;
          `}
          onClick={handleClickRemoveLayer}
        >
          <DeleteBin
            width={16}
            css={`
              padding-bottom: 2px;
            `}
          />
        </div>
      </div>
      <div>
        <span css="margin-right: 8px;">{t('blend')}</span>

        <SelectBox
          items={[
            ...(!activeLayer ? [{ value: '', label: '---' }] : []),
            { value: 'normal', label: t('compositeModes.normal') },
            { value: 'multiply', label: t('compositeModes.multiply') },
            { value: 'screen', label: t('compositeModes.screen') },
            { value: 'overlay', label: t('compositeModes.overlay') },
            { value: 'clipper', label: t('compositeModes.clipper') },
          ]}
          value={activeLayer?.compositeMode ?? ''}
          onChange={handleChangeCompositeMode}
          placement="top-start"
        />
      </div>
      <div
        css={`
          display: flex;
          align-items: center;
        `}
      >
        <span>{t('opacity')}</span>
        <div
          css={`
            flex: 1;
          `}
        >
          <input
            css={`
              width: 100%;
              vertical-align: bottom;
              background: linear-gradient(
                to right,
                ${rgba('#fff', 0)},
                ${rgba('#fff', 1)}
              );
              ${rangeThumb}
            `}
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={activeLayer?.opacity ?? 100}
            onChange={handleChangeOpacity}
          />
        </div>
      </div>
    </div>
  )
})

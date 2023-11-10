import {
  AccordionContent,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
} from '@/components/Accordion'
import { DisplayContents } from '@/components/DisplayContents'
import { DropdownMenu, DropdownMenuItem } from '@/components/DropdownMenu'
import { FloatablePane } from '@/components/FloatablePane'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { useCanvasEditorState, usePaplicoInstance } from '@/domains/engine'
import { useEditorStore } from '@/domains/uiState'
import Paplico, { Commands, Document } from '@paplico/core-new'
import { Box, Button, ContextMenu } from '@radix-ui/themes'
import React, { MouseEvent, memo, useEffect, useMemo, useRef } from 'react'
import { RxEyeNone, RxEyeOpen, RxPlus } from 'react-icons/rx'
import useEvent from 'react-use-event-hook'
import styled, { css } from 'styled-components'
import { TransFn, useTranslation } from '@/lib/i18n'
import { filtersPaneTexts } from '@/locales'
import {
  assign,
  deepClone,
  roundString,
  unreachable,
} from '@paplico/shared-lib'
import { PaneUIImpls } from '@/components/FilterPane'

export const LayerFiltersPane = memo(function LayerFiltersPane() {
  const { strokingTarget, selectedVisu } = useCanvasEditorState((s) => ({
    strokingTarget: s.getStrokingTarget(),
    selectedVisu: s.getSelectedVisuUids()[0]
      ? s.currentDocument?.getVisuByUid(s.getSelectedVisuUids()[0])
      : null,
  }))

  return (
    <FloatablePane paneId={FloatablePaneIds.filters} title="Filters">
      <Box
        css={css`
          background-color: var(--gray-3);
          border-radius: 4px;
        `}
      >
        {!selectedVisu ? (
          <NoLayerSelected />
        ) : (
          <FilterList selectedVisu={selectedVisu} />
        )}
      </Box>
    </FloatablePane>
  )
})

export const FilterList = memo(function FilterList({
  selectedVisu,
}: {
  selectedVisu: Document.VisuElement.AnyElement
}) {
  const t = useTranslation(filtersPaneTexts)
  const {
    getPaneExpandedFilterUids,
    setPaneExpandedFilterState,
    filterPaneExpandState,
  } = useEditorStore()

  const { pplc, availableFilters } = useCanvasEditorState((s) => ({
    pplc: s.paplico,
    availableFilters: s.availableFilters,
  }))

  const prevExpandedUids = useRef<string[]>([])

  const handleClickAddFilter = useEvent((e: MouseEvent<HTMLDivElement>) => {
    const filterId = e.currentTarget.dataset.filterId!

    if (!pplc) return
    if (!filterId) return

    if (!selectedVisu) return

    let filter: Document.VisuFilter.AnyFilter
    if (filterId === 'fill') {
      filter = Document.visu.createVisuallyFilter('fill', {
        enabled: true,
        fill: pplc.getFillSetting() ?? pplc.cloneInitialFillSetting(),
      })
    } else if (filterId === 'stroke') {
      filter = Document.visu.createVisuallyFilter('stroke', {
        enabled: true,
        stroke: pplc.getBrushSetting() ?? pplc.cloneInitialBrushSetting(),
        ink: pplc.getInkSetting() ?? pplc.cloneInitialInkSetting(),
      })
    } else {
      const FilterClass = pplc!.filters.getClass(filterId)
      if (!FilterClass) return

      filter = Document.visu.createVisuallyFilter('postprocess', {
        processor: {
          filterId: FilterClass.metadata.id,
          filterVersion: FilterClass.metadata.version,
          settings: FilterClass.getInitialSetting(),
          enabled: true,
          opacity: 1,
        },
      })
    }

    console.log(filter)

    setPaneExpandedFilterState(filter.uid, true)

    pplc!.command.do(
      new Commands.VisuManipulateFilters([
        {
          visuUid: selectedVisu.uid,
          add: filter,
        },
      ]),
    )
  })

  const handleClickToggleEnabled = useEvent(
    (e: MouseEvent<HTMLSpanElement>) => {
      const filterUid = e.currentTarget.dataset.filterUid!

      pplc!.command.do(
        new Commands.VisuManipulateFilters([
          {
            visuUid: selectedVisu!.uid,
            filterUid: filterUid,
            update: (filter) => (filter.enabled = !filter.enabled),
          },
        ]),
      )
    },
  )

  const handleClickRemoveFilter = useEvent((e: MouseEvent<HTMLDivElement>) => {
    const filterUid = e.currentTarget.dataset.filterUid!

    pplc!.command.do(
      new Commands.VisuManipulateFilters([
        {
          visuUid: selectedVisu!.uid,
          filterUid: filterUid,
          remove: true,
        },
      ]),
    )
  })

  const handleChangeExpandedFilters = useEvent((filterUids: string[]) => {
    const toCollapsed = prevExpandedUids.current.filter(
      (uid) => !filterUids.includes(uid),
    )

    // console.log({ filterUids, toCollapsed })
    filterUids.forEach((uid) => setPaneExpandedFilterState(uid, true))
    toCollapsed.forEach((uid) => setPaneExpandedFilterState(uid, false))

    prevExpandedUids.current = filterUids
  })

  const handleChangeStrokeFilterSetting = useEvent(
    (
      filterUid: string,
      updater: (next: Document.VisuFilter.StrokeFilter) => void,
    ) => {
      pplc!.command.do(
        new Commands.VisuManipulateFilters([
          {
            visuUid: selectedVisu!.uid,
            filterUid: filterUid,
            update: (filter) => {
              if (filter.kind !== 'stroke') return
              updater(filter)
            },
          },
        ]),
      )
    },
  )

  const paneExpandedFilterUids = useMemo(
    () => getPaneExpandedFilterUids(),
    [filterPaneExpandState],
  )

  useEffect(() => {
    // return pplc?.on('history:affect', ({ layerIds }) => {
    //   if (layerIds.includes(strokingTarget.visuUid)) rerender()
    // })
  }, [pplc, selectedVisu?.uid])

  return (
    <>
      <div>
        {selectedVisu.filters.length === 0 ? (
          <NoAvailable>No filters</NoAvailable>
        ) : (
          <AccordionRoot
            type="multiple"
            value={paneExpandedFilterUids}
            onValueChange={handleChangeExpandedFilters}
          >
            {selectedVisu.filters.map((filter) => (
              <AccordionItem key={filter.uid} value={filter.uid}>
                <div
                  css={css`
                    display: flex;
                    align-items: center;
                    padding: 4px 8px;
                    line-height: 1;
                  `}
                >
                  <span
                    onClick={handleClickToggleEnabled}
                    data-filter-uid={filter.uid}
                  >
                    {filter.enabled ? (
                      <RxEyeOpen size={16} />
                    ) : (
                      <RxEyeNone size={16} />
                    )}
                  </span>

                  <ContextMenu.Root>
                    <ContextMenu.Trigger>
                      <DisplayContents>
                        <AccordionTrigger
                          css={css`
                            margin-left: 8px;
                            padding: 0;
                          `}
                        >
                          {getFilterName(t, pplc, filter)}
                        </AccordionTrigger>
                      </DisplayContents>
                    </ContextMenu.Trigger>

                    <ContextMenu.Content size="1">
                      <ContextMenu.Item
                        onClick={handleClickRemoveFilter}
                        data-filter-uid={filter.uid}
                      >
                        Remove
                      </ContextMenu.Item>
                    </ContextMenu.Content>
                  </ContextMenu.Root>
                </div>

                <AccordionContent
                  css={css`
                    position: relative;
                    padding: 2px 8px 8px 0;
                  `}
                >
                  <div
                    css={css`
                      position: absolute;
                      top: 0;
                      bottom: 0;
                      left: 14px;
                      flex: 1;
                      border-left: 1px solid var(--gray-8);
                    `}
                  />

                  <div
                    css={css`
                      margin-left: 26px;

                      & :not(input, textarea, select) {
                        user-select: none;
                      }
                    `}
                  >
                    {selectedVisu &&
                      // prettier-ignore
                      (filter.kind === 'stroke' ? (
                        <StrokeSetting filter={deepClone(filter)} onChange={handleChangeStrokeFilterSetting} />
                      )
                      : filter.kind === 'postprocess' ? (
                        pplc?.paneUI.renderFilterPane(
                          selectedVisu.uid,
                          filter,
                          {
                            onSettingsChange: (next) => {
                              console.log(next)
                            },
                          },
                      )
                    ) : null)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </AccordionRoot>
        )}
      </div>
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
            data-filter-id="fill"
            onClick={handleClickAddFilter}
          >
            Fill
          </DropdownMenuItem>
          <DropdownMenuItem
            data-filter-id="stroke"
            onClick={handleClickAddFilter}
          >
            Stroke
          </DropdownMenuItem>
          {availableFilters?.map((Class) => (
            <DropdownMenuItem
              key={Class.metadata.id}
              data-filter-id={Class.metadata.id}
              onClick={handleClickAddFilter}
            >
              {Class.metadata.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenu>
      </div>
    </>
  )
})

export const NoLayerSelected = memo(function NoLayerSelected() {
  return <NoAvailable>Layer not selected</NoAvailable>
})

const StrokeSetting = memo(function StrokeSetting({
  filter,
  onChange,
}: {
  filter: Document.VisuFilter.StrokeFilter
  onChange: (
    filterUid: string,
    updater: (next: Document.VisuFilter.StrokeFilter) => void,
  ) => void
}) {
  const t = useTranslation(filtersPaneTexts)

  const handleChangeStrokeWidth = useEvent((nextValue: number) => {
    onChange(filter.uid, (next) => {
      next.stroke.size = nextValue
    })
  })

  return (
    <div>
      <PaneUIImpls.FieldSet
        title={t('stroke.width')}
        displayValue={roundString(filter.stroke.size, 2)}
        inputs={
          <PaneUIImpls.Slider
            min={0}
            max={100}
            value={filter.stroke.size}
            onChange={handleChangeStrokeWidth}
          />
        }
      />
    </div>
  )
})

// function isFilterAvailableType(
//   layer: Document.LayerEntity,
// ): layer is Exclude<
//   Document.LayerEntity,
//   Document.LayerEntityTypes.ArtboradLayer | Document.LayerEntityTypes.RootLayer
// > {
//   return !(layer?.layerType === 'artboard' || layer?.layerType === 'root')
// }

const NoAvailable = styled.span`
  display: inline-block;
  padding: 8px;
  color: var(--gray-9);
  font-size: var(--font-size-2);
`

function getFilterName(
  t: TransFn<typeof filtersPaneTexts>,
  pplc: Paplico | null,
  filter: Document.VisuFilter.AnyFilter,
) {
  if (filter.kind === 'postprocess') {
    if (!pplc) return t('loading')

    const Class = pplc?.filters.getClass(filter.processor.filterId)
    return (
      Class?.metadata.name ??
      Class?.metadata.id ??
      t('filterType.missingPostProcess', { id: filter.processor.filterId })
    )
  } else if (filter.kind === 'fill') {
    return t('filterType.fill')
  } else if (filter.kind === 'stroke') {
    return t('filterType.stroke')
  }

  unreachable(filter)
}

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
import { usePaplico } from '@/domains/paplico'
import { useEditorStore } from '@/domains/uiState'
import { Commands, Document } from '@paplico/core-new'

import { Box, Button, ContextMenu } from '@radix-ui/themes'
import React, { MouseEvent, memo, useEffect, useMemo, useRef } from 'react'
import { RxEyeNone, RxEyeOpen, RxPlus } from 'react-icons/rx'
import { useUpdate } from 'react-use'
import useEvent from 'react-use-event-hook'
import styled, { css } from 'styled-components'

export const LayerFiltersPane = memo(function LayerFiltersPane() {
  const { papStore } = usePaplico()
  const layer = papStore.activeLayerEntity

  return (
    <FloatablePane paneId={FloatablePaneIds.filters} title="Filters">
      <Box
        css={css`
          background-color: var(--gray-3);
          border-radius: 4px;
        `}
      >
        {!layer ? (
          <NoLayerSelected />
        ) : !isFilterAvailableType(layer) ? (
          <NoAvailable>Can't available for current layer</NoAvailable>
        ) : (
          <FilterList />
        )}
      </Box>
    </FloatablePane>
  )
})

export const FilterList = memo(function FilterList() {
  const { pap, papStore } = usePaplico()
  const {
    getPaneExpandedFilterUids,
    setPaneExpandedFilterState,
    filterPaneExpandState,
  } = useEditorStore()

  const layer = papStore.activeLayerEntity!

  const rerender = useUpdate()
  const prevExpandedUids = useRef<string[]>([])

  const handleClickAddFilter = useEvent((e: MouseEvent<HTMLDivElement>) => {
    const filterId = e.currentTarget.dataset.filterId!
    const FilterClass = pap!.filters.getClass(filterId)

    if (!filterId) return
    if (!FilterClass) return
    if (!papStore.activeLayerEntity) return

    const filter = Document.createFilterEntry({
      filterId: FilterClass.metadata.id,
      filterVersion: FilterClass.metadata.version,
      settings: FilterClass.getInitialConfig(),
      enabled: true,
      opacity: 1,
    })

    setPaneExpandedFilterState(filter.uid, true)

    pap!.command.do(
      new Commands.LayerUpdateAttributes(papStore.activeLayerEntity.uid, {
        updater: (layer) => {
          layer.filters.push(filter)
        },
      }),
    )
  })

  const handleClickToggleEnabled = useEvent(
    (e: MouseEvent<HTMLSpanElement>) => {
      const filterUid = e.currentTarget.dataset.filterUid!

      pap!.command.do(
        new Commands.LayerUpdateAttributes(papStore.activeLayerEntity!.uid, {
          updater: (layer) => {
            const filter = layer.filters.find(
              (filter) => filter.uid === filterUid,
            )
            if (!filter) return

            filter.enabled = !filter.enabled
          },
        }),
      )
    },
  )

  const handleClickRemoveFilter = useEvent((e: MouseEvent<HTMLDivElement>) => {
    const filterUid = e.currentTarget.dataset.filterUid!

    pap!.command.do(
      new Commands.LayerUpdateAttributes(papStore.activeLayerEntity!.uid, {
        updater: (layer) => {
          const filterIndex = layer.filters.findIndex(
            (filter) => filter.uid === filterUid,
          )
          if (filterIndex === -1) return

          layer.filters.splice(filterIndex, 1)
        },
      }),
    )
  })

  const handleChangeExpandedFilters = useEvent((filterUids: string[]) => {
    const toCollapsed = prevExpandedUids.current.filter(
      (uid) => !filterUids.includes(uid),
    )

    console.log({ filterUids, toCollapsed })
    filterUids.forEach((uid) => setPaneExpandedFilterState(uid, true))
    toCollapsed.forEach((uid) => setPaneExpandedFilterState(uid, false))

    prevExpandedUids.current = filterUids
  })

  const paneExpandedFilterUids = useMemo(
    () => getPaneExpandedFilterUids(),
    [filterPaneExpandState],
  )

  useEffect(() => {
    return pap?.on('history:affect', ({ layerIds }) => {
      if (layerIds.includes(layer.uid)) rerender()
    })
  }, [pap, layer.uid])

  return (
    <>
      <div>
        {layer.filters.length === 0 ? (
          <NoAvailable>No filters</NoAvailable>
        ) : (
          <AccordionRoot
            css={css`
              padding: 4px;
            `}
            type="multiple"
            value={paneExpandedFilterUids}
            onValueChange={handleChangeExpandedFilters}
          >
            {layer.filters.map((filter) => (
              <AccordionItem key={filter.uid} value={filter.uid}>
                <div
                  css={css`
                    display: flex;
                    align-items: center;
                    padding: 4px;
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

                  <ContextMenu.Root siz>
                    <ContextMenu.Trigger>
                      <DisplayContents>
                        <AccordionTrigger
                          css={css`
                            margin-left: 8px;
                            padding: 0;
                          `}
                        >
                          {
                            pap?.filters.getClass(filter.filterId)?.metadata
                              .filterName
                          }
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

                <AccordionContent>
                  <div
                    css={css`
                      margin-left: 16px;

                      & :not(input, textarea, select) {
                        user-select: none;
                      }
                    `}
                  >
                    {pap?.paneUI.renderFilterPane(layer.uid, filter)}
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
          {pap?.filters.appearanceEntries.map((Class) => (
            <DropdownMenuItem
              key={Class.metadata.id}
              data-filter-id={Class.metadata.id}
              onClick={handleClickAddFilter}
            >
              {Class.metadata.filterName}
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

function isFilterAvailableType(
  layer: Document.LayerEntity,
): layer is Exclude<
  Document.LayerEntity,
  Document.LayerEntityTypes.ArtboradLayer | Document.LayerEntityTypes.RootLayer
> {
  return !(layer?.layerType === 'artboard' || layer?.layerType === 'root')
}

const NoAvailable = styled.span`
  display: inline-block;
  padding: 8px;
  color: var(--gray-9);
  font-size: var(--font-size-2);
`

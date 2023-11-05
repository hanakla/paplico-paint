import { FloatablePane } from '@/components/FloatablePane'
import { TreeView } from '@/components/TreeView'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { usePaplicoInstance, useEngineStore } from '@/domains/paplico'
import { Commands, Document, Paplico } from '@paplico/core-new'
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
  //   LayerTreeNode,
  convertLayerNodeToTreeViewNode,
  //   updateLayerTree,
} from './LayersPaZne/structs'
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
import { usePropsMemo, useStableLatestRef } from '@/utils/hooks'
import {
  ContextMenu,
  ContextMenuItemClickHandler,
  useContextMenu,
} from '@/components/ContextMenu'
import { useTranslation } from '@/lib/i18n'
import { layersPaneTexts } from '@/locales'
import { NewTreeView } from './LayersPane/NewTreeView'

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

export const LayersPane = memo(function LayersPane({ size = 'sm' }: Props) {
  const t = useTranslation(layersPaneTexts)
  const { pplc: pplc } = usePaplicoInstance()
  const papStore = useEngineStore(storePicker(['strokeTargetVisually']))
  const rerender = useUpdate()
  const propsMemo = usePropsMemo()
  const layerItemMenu = useContextMenu<LayerContextMenuParams>()

  const strokeTargetVis = papStore.strokeTargetVisually

  const handleChangeLayerName = useEvent((e: ChangeEvent<HTMLInputElement>) => {
    if (!strokeTargetVis) return

    const name = e.currentTarget.value

    pplc?.command.do(
      new Commands.LayerUpdateAttributes(strokeTargetVis.uid, {
        updater: (layer) => {
          layer.name = name
        },
      }),
    )
  })

  const handleChangeCompositeMode = useEvent((mode: string) => {
    console.log(mode)

    pplc?.command.do(
      new Commands.LayerUpdateAttributes(strokeTargetVis!.uid, {
        updater: (layer) => {
          layer.compositeMode = mode as any
        },
      }),
    )
  })

  const handleClickAddLayer = useEvent((e: MouseEvent<HTMLDivElement>) => {
    if (!pplc?.currentDocument) return

    const type = e.currentTarget.dataset.layerType!

    // prettier-ignore
    const layer =
      type === 'normal'
        ? Document.createRasterLayerEntity({
            width: pplc?.currentDocument.meta.mainArtboard.width,
            height: pplc?.currentDocument.meta.mainArtboard.height,
          })
      : type === 'vector'
        ? Document.createVectorLayerEntity({})
      : null

    if (!layer) return

    pplc.command.do(
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
    return pplc?.on('history:affect', ({ layerIds }) => {
      if (layerIds.includes(strokeTargetVis?.uid ?? '')) rerender()
    })
  }, [pplc, strokeTargetVis?.uid])

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
      }>
      <Box
        css={css`
          display: flex;
          flex-flow: column;
          gap: 4px;
          margin: 8px 0 12px;
          padding: 8px;
          background-color: var(--gray-3);
          border-radius: 4px;
        `}>
        {!strokeTargetVis ? (
          <PlaceholderString>
            Select a layer to show properties
          </PlaceholderString>
        ) : (
          <>
            <Fieldset label={t('layerName')}>
              <TextField
                size="1"
                value={strokeTargetVis?.name ?? ''}
                placeholder={`<${t('layerName')}>`}
                onChange={handleChangeLayerName}
              />
            </Fieldset>

            <Fieldset
              label={t('compositeMode')}
              valueField={strokeTargetVis?.compositeMode ?? '<Blend mode>'}>
              {propsMemo.memo(
                'blendmode-fieldset-root',
                () => (
                  <Select.Root
                    size="1"
                    value={strokeTargetVis?.compositeMode}
                    onValueChange={handleChangeCompositeMode}>
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
                (strokeTargetVis?.opacity ?? 1) * 100,
                1,
              )}%`}>
              <Slider
                css={css`
                  padding: 8px 0;
                `}
                value={[strokeTargetVis?.opacity ?? 1]}
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
          background-color: var(--gray-3);
          min-height: 300px;
          max-height: 600px;
          border-radius: 4px 4px 0 0;
        `}>
        {!!pplc?.currentDocument && (
          <NewTreeView
          // root={pplc.currentDocument.layerTreeRoot}
          // size={size}
          // onLayerItemContextMenu={handleLayerItemContextMenu}
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
        `}>
        <DropdownMenu
          trigger={
            <Button
              css={css`
                margin: 0;
                color: var(--gray-11);
              `}
              variant="ghost"
              size="1">
              <RxPlus />
            </Button>
          }>
          <DropdownMenuItem
            data-layer-type="normal"
            onClick={handleClickAddLayer}>
            Normal Layer
          </DropdownMenuItem>
          <DropdownMenuItem
            data-layer-type="vector"
            onClick={handleClickAddLayer}>
            Vector Layer
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </FloatablePane>
  )
})

const PlaceholderString = styled.span`
  color: var(--gray-10);
`

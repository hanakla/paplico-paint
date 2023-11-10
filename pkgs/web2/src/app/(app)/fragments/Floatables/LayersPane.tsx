import { FloatablePane } from '@/components/FloatablePane'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { usePaplicoInstance } from '@/domains/engine'
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
import { useStateSync } from '@/utils/hooks'
import { useTranslation } from '@/lib/i18n'
import { layersPaneTexts } from '@/locales'
import { NewTreeView } from './LayersPane/NewTreeView'
import { StoreApi, create } from 'zustand'
import { usePropsMemo } from '@paplico/shared-lib'

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
  const { pplc: pplc, canvasEditor } = usePaplicoInstance()
  const rerender = useUpdate()
  const propsMemo = usePropsMemo()

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
      new Commands.DocumentManipulateLayerNodes({
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
                (strokeTarget?.visu.opacity ?? 1) * 100,
                1,
              )}%`}
            >
              <Slider
                css={css`
                  padding: 8px 0;
                `}
                value={[strokeTarget?.visu.opacity ?? 1]}
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

const PlaceholderStringSpan = styled.span`
  color: var(--gray-10);
`

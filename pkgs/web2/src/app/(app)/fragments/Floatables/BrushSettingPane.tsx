import { memo } from 'react'
import {
  usePaplicoInstance,
  initializeOnlyUseEngineStore,
  useCanvasEditorState,
} from '@/domains/engine'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { FloatablePane } from '@/components/FloatablePane'
import { Listbox, ListboxItem } from '@/components/Listbox'
import { Box } from '@radix-ui/themes'
import useEvent from 'react-use-event-hook'
import { css } from 'styled-components'
import { Document, type Paplico } from '@paplico/core-new'
import { FieldSet } from '@/components/FilterPane/FieldSet'
import { Slider } from '@/components/FilterPane/Slider'
import { useTranslation } from '@/lib/i18n'
import { brushesSettingPaneTexts } from '@/locales'
import { pick } from '@paplico/shared-lib'
import { BrushPreviewCanvas } from '../BrushPreviewCanvas'

export const BrushSettingPane = memo(function BrushSetting() {
  const t = useTranslation(brushesSettingPaneTexts)

  const { pplc, currentBrush, currentInk, showBrushSizePreview } =
    useCanvasEditorState((s) => ({
      pplc: s.paplico,
      currentBrush: s.paplico.getBrushSetting(),
      currentInk: s.paplico.getInkSetting(),
      ...pick(s, ['showBrushSizePreview', 'paplico']),
    }))

  const handleChangeBrush = useEvent((value: string[]) => {
    const target = pplc!.brushes.entries.find(
      (entry) => entry.metadata.id === value[0],
    )

    if (!target) return

    pplc!.setBrushSetting({
      brushId: target.metadata.id,
      brushVersion: '0.0.1',
      specific: target.getInitialSetting(),
    })
  })

  const handleChangeBrushSize = useEvent((value: number) => {
    showBrushSizePreview?.(value, { durationMs: 800 })
    pplc!.setBrushSetting({
      size: value,
    })
  })

  return (
    <FloatablePane paneId={FloatablePaneIds.brushSettings} title={t('title')}>
      <div
        css={css`
          margin-bottom: 8px;
        `}
      >
        <Listbox
          value={currentBrush ? [currentBrush.brushId] : []}
          onChange={handleChangeBrush}
        >
          {pplc?.brushes.entries.map((entry) => (
            <ListboxItem key={entry.metadata.id} value={entry.metadata.id}>
              {entry.metadata.name}
            </ListboxItem>
          ))}
        </Listbox>
      </div>

      <div>
        <Box
          css={css`
            padding: 4px 8px;
            background-color: var(--gray-3);
            border-radius: 4px;
          `}
        >
          <BrushPreviewCanvas
            css={css`
              height: 100px;
            `}
          />

          <FieldSet
            title={t('size')}
            displayValue={currentBrush?.size ?? 0}
            inputs={
              <Slider
                min={0.1}
                max={200}
                step={0.1}
                value={currentBrush?.size ?? 0}
                onChange={handleChangeBrushSize}
              />
            }
          />

          <CustomPane />
        </Box>
      </div>
    </FloatablePane>
  )
})

const CustomPane = memo(function CustomPane() {
  const { pplc } = usePaplicoInstance()

  const { currentBrush } = initializeOnlyUseEngineStore((s) => ({
    currentBrush: s.engineState?.currentBrush,
  }))

  const onSettingsChange = useEvent(
    (settings: Document.VisuFilter.Structs.BrushSetting) => {
      pplc!.setBrushSetting(settings)
    },
  )

  const brushSetting = currentBrush
  const BrushClass = pplc?.brushes.getClass(currentBrush?.brushId ?? '')

  return (
    BrushClass &&
    brushSetting &&
    pplc?.paneUI.renderBrushPane(BrushClass?.metadata.id, brushSetting, {
      onSettingsChange,
    })
  )
})

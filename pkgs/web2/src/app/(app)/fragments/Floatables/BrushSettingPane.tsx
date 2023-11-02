import { memo } from 'react'
import { usePaplico, usePaplicoStore } from '@/domains/paplico'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { FloatablePane } from '@/components/FloatablePane'
import { Listbox, ListboxItem } from '@/components/Listbox'
import { Box } from '@radix-ui/themes'
import useEvent from 'react-use-event-hook'
import { css } from 'styled-components'
import { type Paplico } from '@paplico/core-new'
import { FieldSet } from '@/components/FilterPane/FieldSet'
import { Slider } from '@/components/FilterPane/Slider'
import { useTranslation } from '@/lib/i18n'
import { brushesSettingPaneTexts } from '@/locales'

export const BrushSettingPane = memo(function BrushSetting() {
  const t = useTranslation(brushesSettingPaneTexts)
  const { pap, editorHandle } = usePaplico()
  const { currentStroke } = usePaplicoStore((s) => ({
    currentStroke: s.engineState?.currentStroke,
  }))

  const handleChangeBrush = useEvent((value: string[]) => {
    const target = pap!.brushes.brushEntries.find(
      (entry) => entry.metadata.id === value[0],
    )

    if (!target) return

    pap!.setStrokeSetting({
      brushId: target.metadata.id,
      brushVersion: '0.0.1',
      specific: {},
    })
  })

  const handleChangeBrushSize = useEvent((value: number) => {
    editorHandle?.showBrushSizePreview(value, { durationMs: 800 })
    pap!.setStrokeSetting({
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
          value={currentStroke ? [currentStroke.brushId] : []}
          onChange={handleChangeBrush}
        >
          {pap?.brushes.brushEntries.map((entry) => (
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
          <FieldSet
            title={t('size')}
            displayValue={currentStroke?.size ?? 0}
            input={
              <Slider
                min={0.1}
                max={200}
                step={0.1}
                value={currentStroke?.size ?? 0}
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
  const { pap } = usePaplico()

  const { currentStroke } = usePaplicoStore((s) => ({
    currentStroke: s.engineState?.currentStroke,
  }))

  const onSettingsChange = useEvent((settings: Paplico.StrokeSetting) => {
    pap!.setStrokeSetting(settings)
  })

  const strokeSetting = currentStroke
  const BrushClass = pap?.brushes.getClass(currentStroke?.brushId ?? '')

  return (
    BrushClass &&
    strokeSetting &&
    pap?.paneUI.renderBrushPane(BrushClass?.metadata.id, strokeSetting, {
      onSettingsChange,
    })
  )
})

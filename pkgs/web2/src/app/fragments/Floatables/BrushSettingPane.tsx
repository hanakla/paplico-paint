import { memo } from 'react'
import { usePaplico } from '@/domains/paplico'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { FloatablePane } from '@/components/FloatablePane'
import { Listbox, ListboxItem } from '@/components/Listbox'
import { Slider } from '@radix-ui/themes'
import useEvent from 'react-use-event-hook'
import { css } from 'styled-components'

export const BrushSettingPane = memo(function BrushSetting() {
  const { pap, papStore } = usePaplico()

  const handleChangeBrush = useEvent((value: string[]) => {
    const target = pap!.brushes.brushEntries.find(
      (entry) => entry.id === value[0],
    )

    pap!.strokeSetting = {
      ...pap!.strokeSetting,
      brushId: target.id,
      brushVersion: '0.0.1',
      specific: {},
    }
  })

  const handleChangeBrushSize = useEvent(([value]: number[]) => {
    pap!.strokeSetting = {
      ...pap!.strokeSetting,
      size: value,
    }
  })

  return (
    <FloatablePane paneId={FloatablePaneIds.brushSettings} title="Brushes">
      {papStore.engineState && (
        <div
          css={css`
            margin-bottom: 8px;
          `}
        >
          <Listbox
            value={
              papStore.engineState.currentStroke
                ? [papStore.engineState.currentStroke.brushId]
                : []
            }
            onChange={handleChangeBrush}
          >
            {pap?.brushes.brushEntries.map((entry) => (
              <ListboxItem key={entry.id} value={entry.id}>
                {entry.id}
              </ListboxItem>
            ))}
          </Listbox>
        </div>
      )}

      <div>
        <label>
          <span>Size: {papStore.engineState?.currentStroke?.size ?? 0}</span>
          <Slider
            min={0.1}
            max={500}
            step={0.1}
            defaultValue={[papStore.engineState?.currentStroke?.size ?? 0]}
            onValueChange={handleChangeBrushSize}
          />
        </label>
      </div>
    </FloatablePane>
  )
})

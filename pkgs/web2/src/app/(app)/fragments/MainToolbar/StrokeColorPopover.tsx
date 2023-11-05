import { usePaplicoInstance } from '@/domains/paplico'
import { memo } from 'react'
import { rgbaToPapColor, useToolbarStore } from './toolbar.store'
import { storePicker } from '@/utils/zutrand'
import { usePropsMemo } from '@/utils/hooks'
import useEvent from 'react-use-event-hook'
import {
  Alpha,
  Brightness,
  ColorChangeHandler,
  Hue,
  SatAndBright,
  Saturation,
} from '@/components/ColorPicker'
import { Popover } from '@/components/Popover'
import { Fieldset } from '@/components/Fieldset'
import { TextField } from '@/components/TextField'
import { css } from 'styled-components'

export const StrokeColorPopoverTrigger = memo(
  function StrokeColorPopoverTrigger({}: {}) {
    const { pplc: pap } = usePaplicoInstance()
    const { strokeColorHSB, strokeColorString, set } = useToolbarStore(
      storePicker(['strokeColorHSB', 'strokeColorString', 'set']),
    )
    const propsMemo = usePropsMemo()

    const handleChangeStrokeColor = useEvent<ColorChangeHandler>((color) => {
      set({ strokeColorHSB: color.hsb })

      pap!.setBrushSetting({
        color: rgbaToPapColor(color.rgb),
      })
    })

    return (
      <Popover
        trigger={propsMemo.memo(
          'strokecolor-popover-trigger',
          () => (
            <svg width={32} height={32} viewBox="0 0 32 32">
              <line
                stroke={strokeColorString}
                strokeWidth={2}
                strokeLinecap="round"
                x1={8}
                y1={8}
                x2={24}
                y2={24}
              />
            </svg>
          ),
          [strokeColorString],
        )}
        side="top">
        <div
          css={css`
            display: flex;
            flex-flow: column;
            gap: 8px;
          `}>
          <SatAndBright
            css={css`
              width: 100%;
              aspect-ratio: 1;
            `}
            color={strokeColorHSB}
            onChange={handleChangeStrokeColor}
            onChangeComplete={handleChangeStrokeColor}
          />
          <Fieldset
            label="Hue"
            valueField={
              <TextField
                type="number"
                size="1"
                value={Math.round(strokeColorHSB.h)}
              />
            }>
            <Hue
              color={strokeColorHSB}
              onChange={handleChangeStrokeColor}
              onChangeComplete={handleChangeStrokeColor}
            />
          </Fieldset>

          <Saturation
            color={strokeColorHSB}
            onChange={handleChangeStrokeColor}
            onChangeComplete={handleChangeStrokeColor}
          />

          <Brightness
            color={strokeColorHSB}
            onChange={handleChangeStrokeColor}
            onChangeComplete={handleChangeStrokeColor}
          />

          <Alpha
            color={strokeColorHSB}
            onChange={handleChangeStrokeColor}
            onChangeComplete={handleChangeStrokeColor}
          />
        </div>
      </Popover>
    )
  },
)

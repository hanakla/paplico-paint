import { useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { PapCommands } from '@paplico/core'
import { ChangeEvent, memo } from 'react'
import { useUpdate } from 'react-use'
import { RangeInput } from '🙌/components/RangeInput'
import { EditorOps, EditorSelector } from '🙌/domains/EditorStable'
import { useFleur } from '🙌/utils/hooks'
import { SelectBox } from '🙌/components/SelectBox'
import { TextInput } from '🙌/components/TextInput'
import { roundString } from '🙌/utils/StringUtils'
import { useTransactionCommand } from '../../hooks'
import { Column, OpacityColumn } from './_components'
import { FilterPaneProps } from './_shared'
import { useTranslation } from 'next-i18next'
import { Stack } from '../../../../components/Stack'

export const HueShift = memo(function HueShift({
  layer,
  filter,
}: FilterPaneProps) {
  const { t } = useTranslation('app')

  const activeLayerPath = useStore(EditorSelector.activeLayerPath)
  const transCommand = useTransactionCommand()

  const handleChangeColorSpace = useFunk<SelectBox.OnChangeHandler>((value) => {
    if (!activeLayerPath) return

    transCommand.autoStartAndDoAdd(
      new PapCommands.Filter.PatchAttr({
        pathToTargetLayer: activeLayerPath,
        filterUid: filter.uid,
        patcher: (attr) => {
          attr.settings.colorSpace = value
        },
      })
    )
  })

  const handleChangeDistance = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      transCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attr) => {
            attr.settings.shift = currentTarget.valueAsNumber
          },
        })
      )
    }
  )

  const handleChangeComplete = useFunk(() => {
    transCommand.commit()
  })

  return (
    <Stack gap={8} dir="vertical">
      <Column
        filter={filter}
        nameKey="shift"
        value={`${roundString(filter.settings.shift * 360)}°`}
      >
        <RangeInput
          css={`
            width: 100%;
          `}
          value={filter.settings.shift}
          step={0.01}
          min={0}
          max={1}
          onChange={handleChangeDistance}
          onChangeComplete={handleChangeComplete}
        />
      </Column>
      <Column filter={filter} nameKey="colorSpace">
        <SelectBox
          items={[
            {
              label: t('filterOptions.@paplico/filters/hue-shift.hsv'),
              value: 'hsv',
            },
            {
              label: t('filterOptions.@paplico/filters/hue-shift.yiq'),
              value: 'yiq',
            },
          ]}
          value={filter.settings.colorSpace}
          onChange={handleChangeColorSpace}
        />
      </Column>
      <OpacityColumn filter={filter} />
    </Stack>
  )
})

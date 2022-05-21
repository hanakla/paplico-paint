import { useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { PapCommands, PapFilters, PapValueTypes } from '@paplico/core'
import { nanoid } from 'nanoid'
import { ChangeEvent, memo } from 'react'
import { useUpdate } from 'react-use'
import { RangeInput } from '🙌/components/RangeInput'
import { EditorOps, EditorSelector } from '🙌/domains/EditorStable'
import { useFleur } from '🙌/utils/hooks'
import { GradientSlider } from '../../../../components/GradientSlider'
import { SelectBox } from '../../../../components/SelectBox'
import { TextInput } from '../../../../components/TextInput'
import { roundString } from '../../../../utils/StringUtils'
import { useTransactionCommand } from '../../hooks'
import { Column, OpacityColumn } from './_components'
import { FilterPaneProps } from './_shared'

const PRESETS: Array<{
  id: string
  value: PapValueTypes.ColorStop1D[]
}> = [
  {
    id: nanoid(),
    value: [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
    ],
  },
  {
    id: nanoid(),
    value: [
      { position: 0, color: { r: 0.3, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 1, g: 0, b: 0, a: 1 } },
    ],
  },
]

export const GradientMap = memo(function GradientMap({
  layer,
  filter,
}: FilterPaneProps) {
  const settings = filter.settings as PapFilters.GradientMapFilter.Params

  // const rerender = useUpdate()
  const { execute } = useFleur()

  const activeLayerPath = useStore(EditorSelector.activeLayerPath)
  const transCommand = useTransactionCommand()

  // const handleChangeColor = useFunk(
  //   ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
  //     if (!activeLayerPath) return

  //     execute(
  //       EditorOps.runCommand,
  //       new PapCommands.Filter.PatchAttr({
  //         pathToTargetLayer: activeLayerPath,
  //         filterUid: filter.uid,
  //         patcher: (attrs) => {
  //           attrs.settings.color = currentTarget.checked
  //         },
  //       })
  //     )
  //   }
  // )

  const handleChangeMap = useFunk<SelectBox.OnChangeHandler>((value) => {
    if (!activeLayerPath) return

    const map = PRESETS.find((entry) => entry.id === value)
    if (!map) return

    transCommand.autoStartAndDoAdd(
      new PapCommands.Filter.PatchAttr({
        pathToTargetLayer: activeLayerPath,
        filterUid: filter.uid,
        patcher: (attrs) => {
          attrs.settings.map = map.value
        },
      })
    )

    transCommand.rerenderCanvas()
  })

  const handleChangeMixRatio = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      transCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attrs) => {
            attrs.settings.mixRatio = currentTarget.valueAsNumber
          },
        })
      )

      transCommand.rerenderCanvas()
    }
  )

  // const handleChangeSeed = useFunk(
  //   ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
  //     if (!activeLayerPath) return

  //     transCommand.autoStartAndDoAdd(
  //       new PapCommands.Filter.PatchAttr({
  //         pathToTargetLayer: activeLayerPath,
  //         filterUid: filter.uid,
  //         patcher: (attrs) => {
  //           attrs.settings.seed = currentTarget.valueAsNumber
  //         },
  //       })
  //     )

  //     transCommand.rerenderCanvas()
  //   }
  // )

  const handleChangeComplete = useFunk(() => {
    transCommand.commit()
  })

  const handleChangeGradientStop = useFunk<GradientSlider.OnChangeCallback>(
    (stops) => {
      if (!activeLayerPath) return

      transCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attrs) => {
            attrs.settings.map = stops
          },
        })
      )
    }
  )

  return (
    <div>
      <Column filter={filter} nameKey="color">
        <label>
          <SelectBox
            placeholder={
              <GradientSlider
                css={`
                  width: 100px;
                `}
                colorStops={settings.map}
                displayOnly
              />
            }
            items={PRESETS.map((entry) => ({
              label: (
                <GradientSlider
                  css={`
                    width: 100px;
                  `}
                  colorStops={entry.value}
                  displayOnly
                />
              ),
              value: entry.id,
            }))}
            onChange={handleChangeMap}
          />
        </label>
      </Column>
      <OpacityColumn filter={filter} />
    </div>
  )
})

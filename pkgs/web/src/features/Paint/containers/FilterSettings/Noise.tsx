import { useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { PapCommands } from '@paplico/core'
import { ChangeEvent, memo } from 'react'
import { useUpdate } from 'react-use'
import { RangeInput } from '🙌/components/RangeInput'
import { EditorOps, EditorSelector } from '🙌/domains/EditorStable'
import { useFleur } from '🙌/utils/hooks'
import { TextInput } from '../../../../components/TextInput'
import { useTransactionCommand } from '../../hooks'
import { Column } from './_components'
import { FilterPaneProps } from './_shared'

export const Noise = memo(function Noise({ layer, filter }: FilterPaneProps) {
  // const rerender = useUpdate()
  const { execute } = useFleur()

  const activeLayerPath = useStore(EditorSelector.activeLayerPath)
  const transCommand = useTransactionCommand()

  const handleChangeColor = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      execute(
        EditorOps.runCommand,
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attrs) => {
            attrs.settings.color = currentTarget.checked
          },
        })
      )
    }
  )

  const handleChangeScale = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      transCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attrs) => {
            attrs.settings.scale = currentTarget.valueAsNumber
          },
        })
      )

      transCommand.rerenderCanvas()
    }
  )

  const handleChangeSeed = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      transCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attrs) => {
            attrs.settings.seed = currentTarget.valueAsNumber
          },
        })
      )

      transCommand.rerenderCanvas()
    }
  )

  const handleBlur = useFunk(() => {
    transCommand.commit()
  })

  return (
    <div>
      <Column filter={filter} nameKey="color">
        <label>
          <input
            type="checkbox"
            value={filter.settings.color}
            onChange={handleChangeColor}
          />
        </label>
      </Column>
      <Column filter={filter} nameKey="scale">
        <TextInput
          sizing="sm"
          type="number"
          step={1}
          value={filter.settings.scale}
          onChange={handleChangeScale}
        />
      </Column>
      <Column filter={filter} nameKey="seed">
        <TextInput
          sizing="sm"
          type="number"
          step={1}
          value={filter.settings.seed}
          onChange={handleChangeSeed}
          onBlur={handleBlur}
        />
      </Column>
    </div>
  )
})

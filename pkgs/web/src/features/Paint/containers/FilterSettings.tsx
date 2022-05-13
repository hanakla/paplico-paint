import { useFleurContext, useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { useTranslation } from 'next-i18next'
import { ChangeEvent, memo, MouseEvent, ReactNode, useEffect } from 'react'

import { useClickAway, useToggle, useUpdate } from 'react-use'
import { PapCommands, PapDOM, PapDOMDigger, PapFilters } from '@paplico/core'

import { DeltaRange } from '🙌/components/DeltaRange'
import { RangeInput } from '🙌/components/RangeInput'
import { SelectBox } from '🙌/components/SelectBox'
import { EditorOps } from '🙌/domains/EditorStable'
import { useFleur } from '🙌/utils/hooks'
import { roundString } from '🙌/utils/StringUtils'

import { EditorSelector } from '🙌/domains/EditorStable'
import { usePapFilterWatch, useTransactionCommand } from '../hooks'

import { Stack } from '🙌/components/Stack'
import { Column, LayerSelector, ColorInput } from './FilterSettings/_components'
import { Noise } from './FilterSettings/Noise'

type Props = { layer: PapDOM.LayerTypes; filter: PapDOM.Filter }

export const FilterSettings = ({ layer, filter }: Props) => {
  const filterId = filter.filterId as {
    [K in keyof typeof PapFilters]: typeof PapFilters[K]
  }[keyof typeof PapFilters]['id']

  switch (filterId) {
    case '@paplico/filters/bloom': {
      return <BloomSetting layer={layer} filter={filter} />
    }
    case '@paplico/filters/gauss-blur': {
      return <GaussBlur layer={layer} filter={filter} />
    }
    case '@paplico/filters/chromatic-aberration': {
      return <ChromaticAberration layer={layer} filter={filter} />
    }
    case '@paplico/filters/halftone': {
      return <Halftone layer={layer} filter={filter} />
    }
    case '@paplico/filters/binarization': {
      return <Binarization layer={layer} filter={filter} />
    }
    case '@paplico/filters/glitch-jpeg': {
      return <GlitchJpeg layer={layer} filter={filter} />
    }
    case '@paplico/filters/low-reso': {
      return <LowReso layer={layer} filter={filter} />
    }
    case '@paplico/filters/noise': {
      return <Noise layer={layer} filter={filter} />
    }
    case '@paplico/filters/outline': {
      return <Outline layer={layer} filter={filter} />
    }
    case '@paplico/filters/zoom-blur': {
      return <ZoomBlur layer={layer} filter={filter} />
    }
    case '@paplico/filters/kawase-blur': {
      return <KawaseBlur layer={layer} filter={filter} />
    }
    case '@paplico/filters/uvreplace': {
      return <UVReplace layer={layer} filter={filter} />
    }
    default: {
      return <>🤔</>
    }
  }
}

const BloomSetting = ({ layer, filter }: Props) => {
  const { executeOperation } = useFleurContext()

  // const handleChange = useFunk(() => {
  //   editorActions.updateFilter(layer.id, filter.uid, (filter) => {})
  // }, [layer, filter])

  const handleChangeComplete = useFunk(() => {
    executeOperation(EditorOps.rerenderCanvas)
  })

  return (
    <div>
      <Column filter={filter} nameKey="threshold">
        {/* <DeltaRange value={filter.settings.threshold} /> */}
      </Column>
    </div>
  )
}

const GaussBlur = ({ layer, filter }: Props) => {
  const { executeOperation } = useFleurContext()

  const handleChangeRadius = useFunk((value: number) => {
    executeOperation(
      EditorOps.updateFilter,
      layer.uid,
      filter.uid,
      (filter) => {
        filter.settings.radius = value
      }
    )
  })

  const handleChangePower = useFunk((value: number) => {
    executeOperation(
      EditorOps.updateFilter,
      layer.uid,
      filter.uid,
      (filter) => {
        filter.settings.power = value
      }
    )
  })

  const handleChangeComplete = useFunk(() => {
    executeOperation(EditorOps.rerenderCanvas)
  })

  return (
    <div>
      <Column
        filter={filter}
        nameKey="radius"
        value={roundString(filter.settings.radius, 2)}
      >
        <DeltaRange
          css={`
            width: 100%;
          `}
          value={filter.settings.radius}
          step={0.1}
          min={0}
          onChange={handleChangeRadius}
          onChangeComplete={handleChangeComplete}
        />
      </Column>

      {process.env.NODE_ENV === 'development' && (
        <Column
          filter={filter}
          nameKey="powerDev"
          value={roundString(filter.settings.power, 2)}
        >
          <DeltaRange
            css={`
              width: 100%;
            `}
            value={filter.settings.power}
            step={0.1}
            min={0}
            onChange={handleChangePower}
            onChangeComplete={handleChangeComplete}
          />
        </Column>
      )}
    </div>
  )
}

const ChromaticAberration = ({ layer, filter }: Props) => {
  const { execute } = useFleur()
  const activeLayerPath = useStore(EditorSelector.activeLayerPath)
  const trnsCommand = useTransactionCommand({ threshold: 2000 })

  const handleChangeDistance = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      trnsCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attr) => {
            attr.settings.distance = currentTarget.valueAsNumber
          },
        })
      )
    }
  )

  const handleChangeAngleDeg = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      trnsCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attr) => {
            attr.settings.angleDeg = currentTarget.valueAsNumber
          },
        })
      )
    }
  )

  const handleChangeComplete = useFunk(() => {
    execute(EditorOps.rerenderCanvas)
  })

  return (
    <div>
      <Column
        filter={filter}
        nameKey="distance"
        value={roundString(filter.settings.distance, 2)}
      >
        <RangeInput
          css={`
            width: 100%;
          `}
          value={filter.settings.distance}
          step={0.1}
          min={0}
          onChange={handleChangeDistance}
          onChangeComplete={handleChangeComplete}
        />
      </Column>
      <Column
        filter={filter}
        nameKey="angleDeg"
        value={`${roundString(filter.settings.angleDeg)}°`}
      >
        <RangeInput
          css={`
            width: 100%;
          `}
          value={filter.settings.angleDeg}
          min={0}
          max={360}
          step={0.1}
          onChange={handleChangeAngleDeg}
          onChangeComplete={handleChangeComplete}
        />
      </Column>
    </div>
  )
}

const Halftone = ({ layer, filter }: Props) => {
  const { t } = useTranslation('app')
  const activeLayerPath = useStore(EditorSelector.activeLayerPath)
  const trnsCommand = useTransactionCommand({ threshold: 2000 })

  const handleChangeShape = useFunk((value: string) => {
    if (!activeLayerPath) return

    trnsCommand.autoStartAndDoAdd(
      new PapCommands.Filter.PatchAttr({
        pathToTargetLayer: activeLayerPath,
        filterUid: filter.uid,
        patcher: (attr) => {
          attr.settings.shape = +value
        },
      })
    )
  })

  const handleChangeRadius = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      trnsCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attr) => {
            attr.settings.radius = currentTarget.valueAsNumber
          },
        })
      )
    }
  )

  const handleChangeScatter = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      trnsCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attr) => {
            attr.settings.scatter = currentTarget.valueAsNumber
          },
        })
      )
    }
  )

  return (
    <div>
      <Column
        filter={filter}
        nameKey="shape"
        value={`${roundString(filter.settings.shape)}`}
      >
        <SelectBox
          items={[
            {
              label: t('filterOptions.@paplico/halftone.shapes.dot'),
              value: '1',
            },
            {
              label: t('filterOptions.@paplico/halftone.shapes.ellipse'),
              value: '2',
            },
            {
              label: t('filterOptions.@paplico/halftone.shapes.line'),
              value: '3',
            },
            {
              label: t('filterOptions.@paplico/halftone.shapes.square'),
              value: '4',
            },
          ]}
          value={`${filter.settings.shape}`}
          onChange={handleChangeShape}
        />
      </Column>
      <Column
        filter={filter}
        nameKey="radius"
        value={`${roundString(filter.settings.radius)}`}
      >
        <RangeInput
          min={0}
          max={200}
          step={0.1}
          value={filter.settings.radius}
          onChangeComplete={handleChangeRadius}
        />
      </Column>
      <Column
        filter={filter}
        nameKey="scatter"
        value={`${roundString(filter.settings.scatter)}`}
      >
        <RangeInput
          min={0}
          max={200}
          step={0.05}
          value={filter.settings.scatter}
          onChangeComplete={handleChangeScatter}
        />
      </Column>
    </div>
  )
}

const GlitchJpeg = ({ layer, filter }: Props) => {
  const { execute } = useFleur()

  const handleChangeCopies = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
        filter.settings.copies = currentTarget.valueAsNumber
      })
    }
  )

  const handleChangeQuality = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
        filter.settings.quality = currentTarget.valueAsNumber / 100
      })
    }
  )

  return (
    <div>
      <Column
        nameKey="copies"
        filter={filter}
        value={roundString(filter.settings.copies, 0)}
      >
        <RangeInput
          type="range"
          min={0}
          max={32}
          step={1}
          value={filter.settings.copies}
          onChange={handleChangeCopies}
        />
      </Column>
      <Column
        nameKey="quality"
        filter={filter}
        value={roundString(filter.settings.quality * 100, 0)}
      >
        <RangeInput
          type="range"
          min={0}
          max={100}
          step={1}
          value={filter.settings.quality * 100}
          onChange={handleChangeQuality}
        />
      </Column>
    </div>
  )
}

const Binarization = ({ layer, filter }: Props) => {
  const { execute } = useFleur()

  const handleChangeThreshold = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
        filter.settings.level = currentTarget.valueAsNumber
      })
    }
  )

  return (
    <div>
      <Column
        nameKey="level"
        filter={filter}
        value={roundString(filter.settings.level, 0)}
      >
        <RangeInput
          type="range"
          min={0}
          max={255}
          step={1}
          value={filter.settings.level}
          onChange={handleChangeThreshold}
        />
      </Column>
    </div>
  )
}

const LowReso = ({ layer, filter }: Props) => {
  const { execute } = useFleur()

  const handleChangeSameBlocks = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
        filter.settings.sameBlocks = currentTarget.checked
      })
    }
  )

  const handleChangeLevelX = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
        filter.settings.levelX = currentTarget.valueAsNumber
      })
    }
  )

  const handleChangeLevelY = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
        filter.settings.levelY = currentTarget.valueAsNumber
      })
    }
  )

  return (
    <div>
      <Column nameKey="sameBlocks" filter={filter}>
        <input
          type="checkbox"
          checked={filter.settings.sameBlocks}
          onChange={handleChangeSameBlocks}
        />
      </Column>
      <Column
        nameKey="levelX"
        filter={filter}
        value={roundString(filter.settings.levelX, 1)}
      >
        <RangeInput
          min={1}
          max={256}
          step={1}
          value={filter.settings.levelX}
          onChange={handleChangeLevelX}
        />
      </Column>
      <Column
        nameKey="levelY"
        filter={filter}
        value={roundString(filter.settings.levelY, 1)}
      >
        <RangeInput
          min={1}
          max={256}
          step={1}
          value={filter.settings.levelY}
          onChange={handleChangeLevelY}
          disabled={filter.settings.sameBlocks}
        />
      </Column>
    </div>
  )
}

const Outline = ({ layer, filter }: Props) => {
  const { execute } = useFleur()

  const handleChangeThickness = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
        filter.settings.thickness = currentTarget.valueAsNumber
      })
    }
  )

  const handleChangeColor = useFunk((color: any) => {
    execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
      filter.settings.color = color
    })
  })

  return (
    <div>
      <Column
        nameKey="thickness"
        filter={filter}
        value={filter.settings.thickness}
      >
        <RangeInput
          min={1}
          max={256}
          step={1}
          value={filter.settings.thickness}
          onChange={handleChangeThickness}
        />
      </Column>
      <Column nameKey="color" filter={filter}>
        <ColorInput
          value={{
            r: filter.settings.color.r,
            g: filter.settings.color.g,
            b: filter.settings.color.b,
            a: filter.settings.color.a,
          }}
          onChange={handleChangeColor}
        />
      </Column>
    </div>
  )
}

const ZoomBlur = memo(function ZoomBlur({ layer, filter }: Props) {
  const activeLayerPath = useStore(EditorSelector.activeLayerPath)
  const trnsCommand = useTransactionCommand({ threshold: 2000 })

  const handleChangeStrength = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      trnsCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (filter) => {
            filter.settings.strength = currentTarget.valueAsNumber
          },
        })
      )
    }
  )
  const handleChangeCenterX = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      trnsCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (filter) => {
            filter.settings.center[0] = currentTarget.valueAsNumber
          },
        })
      )
    }
  )
  const handleChangeCenterY = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      trnsCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (filter) => {
            filter.settings.center[1] = currentTarget.valueAsNumber
          },
        })
      )
    }
  )

  return (
    <div>
      <Column
        nameKey={'strength'}
        filter={filter}
        value={filter.settings.strength}
      >
        <RangeInput
          min={1}
          max={100}
          step={1}
          value={filter.settings.strength}
          onChange={handleChangeStrength}
        />
      </Column>
      <Column
        nameKey={'centerX'}
        filter={filter}
        value={filter.settings.center[0]}
      >
        <RangeInput
          min={1}
          max={2000}
          step={0.01}
          value={filter.settings.center[0]}
          onChange={handleChangeCenterX}
        />
      </Column>
      <Column
        nameKey={'centerY'}
        filter={filter}
        value={filter.settings.center[1]}
      >
        <RangeInput
          min={1}
          max={2000}
          step={0.01}
          value={filter.settings.center[1]}
          onChange={handleChangeCenterY}
        />
      </Column>
    </div>
  )
})

const KawaseBlur = memo(function KawaseBlur({ layer, filter }: Props) {
  const activeLayerPath = useStore(EditorSelector.activeLayerPath)
  const commandTransaction = useTransactionCommand({ threshold: 2000 })

  usePapFilterWatch(filter)

  const handleChangeBlurSize = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      commandTransaction.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (filter) => {
            filter.settings.blurSize = currentTarget.valueAsNumber
          },
        })
      )
    }
  )
  const handleChangeQuality = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      commandTransaction.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (filter) => {
            filter.settings.quality = currentTarget.valueAsNumber
          },
        })
      )
    }
  )

  const handleChangeComplete = useFunk(() => {
    commandTransaction.commit()
  })

  console.log(filter.settings)

  return (
    <div>
      <Column
        nameKey={'blurSize'}
        filter={filter}
        value={filter.settings.blurSize}
      >
        <RangeInput
          min={1}
          max={100}
          step={1}
          value={filter.settings.blurSize}
          onChange={handleChangeBlurSize}
          onChangeComplete={handleChangeComplete}
        />
      </Column>
      <Column
        nameKey={'quality'}
        filter={filter}
        value={filter.settings.quality}
      >
        <RangeInput
          min={1}
          max={32}
          step={1}
          value={filter.settings.quality}
          onChange={handleChangeQuality}
          onChangeComplete={handleChangeComplete}
        />
      </Column>
    </div>
  )
})

const UVReplace = memo(function UVReplace({ layer, filter }: Props) {
  const { t } = useTranslation('app')
  const rerender = useUpdate()
  const { execute } = useFleur()

  const { activeLayerPath, currentDocument } = useStore((get) => ({
    activeLayerPath: EditorSelector.activeLayerPath(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const commandTransaction = useTransactionCommand({ threshold: 2000 })

  const handleChangeReplacement: SelectBox.OnChangeHandler = useFunk(
    (value) => {
      if (!activeLayerPath) return

      execute(
        EditorOps.runCommand,
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (filter) => {
            filter.settings.replacement = value
          },
        })
      )

      rerender()
    }
  )

  const handleChangeReplaceMapLayerUid = useFunk((layerUid: string) => {
    if (!activeLayerPath) return

    execute(
      EditorOps.runCommand,
      new PapCommands.Filter.PatchAttr({
        pathToTargetLayer: activeLayerPath,
        filterUid: filter.uid,
        patcher: (filter) => {
          filter.settings.replaceMapLayerUid = layerUid
        },
      })
    )

    rerender()
  })

  const handleChangeMovement = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      commandTransaction.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (filter) => {
            const index = currentTarget.dataset.dimention === 'x' ? 0 : 1
            filter.settings.movementPx[index] = currentTarget.valueAsNumber
          },
        })
      )

      commandTransaction.debouncedCommit()

      rerender()
    }
  )

  const handleChangeClamping: SelectBox.OnChangeHandler = useFunk(
    (value: string) => {
      if (!activeLayerPath) return

      execute(
        EditorOps.runCommand,
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (filter) => {
            filter.settings.clamping = value
          },
        })
      )

      rerender()
    }
  )

  return (
    <Stack dir="vertical" gap={8}>
      <Column nameKey="replacement" filter={filter}>
        <SelectBox
          items={[
            {
              label: t(
                'filterOptions.@paplico/filters/uvreplace.replacements.delta'
              ),
              value: 'delta',
            },
            {
              label: t(
                'filterOptions.@paplico/filters/uvreplace.replacements.absolute'
              ),
              value: 'absolute',
            },
          ]}
          value={filter.settings.replacement}
          onChange={handleChangeReplacement}
        />
      </Column>
      <Column nameKey="displacementMapLayer" filter={filter}>
        <LayerSelector
          valueLayerUid={filter.settings.replaceMapLayerUid}
          onChange={handleChangeReplaceMapLayerUid}
        />
      </Column>

      <Column
        nameKey="movementX"
        filter={filter}
        value={filter.settings.movementPx[0]}
      >
        <RangeInput
          min={-currentDocument!.width}
          max={currentDocument!.width}
          step={1}
          value={filter.settings.movementPx[0]}
          onChange={handleChangeMovement}
          data-dimention="x"
          disabled={filter.settings.replacement === 'absolute'}
        />
      </Column>

      <Column
        nameKey="movementY"
        filter={filter}
        value={filter.settings.movementPx[1]}
      >
        <RangeInput
          min={-currentDocument!.height}
          max={currentDocument!.height}
          step={1}
          value={filter.settings.movementPx[1]}
          onChange={handleChangeMovement}
          data-dimention="y"
          disabled={filter.settings.replacement === 'absolute'}
        />
      </Column>

      {/* <Column nameKey="clamping" filter={filter}>
        <SelectBox
          value={filter.settings.clamping}
          items={[
            {
              label: t(
                'filterOptions.@paplico/filters/uvreplace.clampings.repeat'
              ),
              value: 'repeat',
            },

            {
              label: t(
                'filterOptions.@paplico/filters/uvreplace.clampings.mirroredRepeat'
              ),
              value: 'mirrored-repeat',
            },
            {
              label: t(
                'filterOptions.@paplico/filters/uvreplace.clampings.toEdge'
              ),
              value: 'to-edge',
            },
          ]}
          onChange={handleChangeClamping}
        />
      </Column> */}
    </Stack>
  )
})

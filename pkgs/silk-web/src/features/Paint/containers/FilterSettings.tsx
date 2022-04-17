import { useFleurContext } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { useTranslation } from 'next-i18next'
import { memo, ReactNode } from 'react'
import { SilkDOM } from 'silk-core'
import { DeltaRange } from '🙌/components/DeltaRange'
import { SelectBox } from '🙌/components/SelectBox'
import { EditorOps } from '🙌/domains/EditorStable'
import { useFleur } from '🙌/utils/hooks'
import { centering } from '🙌/utils/mixins'
import { roundString } from '🙌/utils/StringUtils'

type Props = { layer: SilkDOM.LayerTypes; filter: SilkDOM.Filter }

export const FilterSettings = ({ layer, filter }: Props) => {
  switch (filter.filterId) {
    case '@silk-core/bloom': {
      return <BloomSetting layer={layer} filter={filter} />
    }
    case '@silk-core/gauss-blur': {
      return <GaussBlur layer={layer} filter={filter} />
    }
    case '@silk-core/chromatic-aberration': {
      return <ChromaticAberration layer={layer} filter={filter} />
    }
    case '@silk-core/halftone': {
      return <Halftone layer={layer} filter={filter} />
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
  }, [])

  const handleChangePower = useFunk((value: number) => {
    executeOperation(
      EditorOps.updateFilter,
      layer.uid,
      filter.uid,
      (filter) => {
        filter.settings.power = value
      }
    )
  }, [])

  const handleChangeComplete = useFunk(() => {
    executeOperation(EditorOps.rerenderCanvas)
  }, [])

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
  const { executeOperation } = useFleurContext()

  const handleChangeDistance = useFunk((value: number) => {
    executeOperation(
      EditorOps.updateFilter,
      layer.uid,
      filter.uid,
      (filter) => {
        filter.settings.distance = value
      }
    )
  }, [])

  const handleChangeAngleDeg = useFunk((value: number) => {
    executeOperation(
      EditorOps.updateFilter,
      layer.uid,
      filter.uid,
      (filter) => {
        filter.settings.angleDeg = value
      }
    )
  }, [])

  const handleChangeComplete = useFunk(() => {
    executeOperation(EditorOps.rerenderCanvas)
  }, [])

  return (
    <div>
      <Column
        filter={filter}
        nameKey="distance"
        value={roundString(filter.settings.distance, 2)}
      >
        <DeltaRange
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
        <DeltaRange
          css={`
            width: 100%;
          `}
          value={filter.settings.angleDeg}
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
  const { execute } = useFleur()

  const handleChangeShape = useFunk((value: string) => {
    execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
      filter.settings.shape = +value
    })
  })

  const handleChangeRadius = useFunk((value: number) => {
    execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
      filter.settings.radius = value
    })
  })

  const handleChangeScatter = useFunk((value: number) => {
    execute(EditorOps.updateFilter, layer.uid, filter.uid, (filter) => {
      filter.settings.scatter = value
    })
  })

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
              label: t('filterOptions.@silk-core/halftone.shapes.dot'),
              value: '1',
            },
            {
              label: t('filterOptions.@silk-core/halftone.shapes.ellipse'),
              value: '2',
            },
            {
              label: t('filterOptions.@silk-core/halftone.shapes.line'),
              value: '3',
            },
            {
              label: t('filterOptions.@silk-core/halftone.shapes.square'),
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
        <DeltaRange
          min={0}
          step={0.1}
          value={filter.settings.radius}
          onChange={handleChangeRadius}
        />
      </Column>
      <Column
        filter={filter}
        nameKey="scatter"
        value={`${roundString(filter.settings.scatter)}`}
      >
        <DeltaRange
          min={0}
          step={0.05}
          value={filter.settings.scatter}
          onChange={handleChangeScatter}
        />
      </Column>
    </div>
  )
}

const Column = memo(
  ({
    nameKey,
    value,
    filter: { filterId },
    children,
  }: {
    nameKey: string
    value?: string
    filter: SilkDOM.Filter
    children: ReactNode
  }) => {
    const { t } = useTranslation('app')

    return (
      <div
        css={`
          padding: 2px 0;

          & + & {
            margin-top: 8px;
          }
        `}
      >
        <div>{t(`filterOptions.${filterId}.${nameKey}`)}</div>

        <div
          css={`
            display: flex;
            margin-top: 4px;
            flex: 1;
            flex-basis: 100%;
            gap: 4px;
          `}
        >
          <div
            css={`
              flex: 1;
            `}
          >
            {children}
          </div>

          {value !== undefined && (
            <div
              css={`
                ${centering({ x: false, y: true })}
                justify-content: flex-end;
                width: 40px;
                margin-left: auto;
                text-align: right;
              `}
            >
              {value}
            </div>
          )}
        </div>
      </div>
    )
  }
)

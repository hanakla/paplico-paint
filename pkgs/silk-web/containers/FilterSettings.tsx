import { useFleurContext } from '@fleur/react'
import { useTranslation } from 'next-i18next'
import { useCallback } from 'react'
import { ReactNode } from 'react'
import { SilkEntity } from 'silk-core'
import { DeltaRange } from '../components/DeltaRange'
import { EditorSlice } from '../domains/Editor'
import { editorOps } from '../domains/EditorStable'
import { centering } from '../utils/mixins'
import { roundString } from '../utils/StringUtils'

type Props = { layer: SilkEntity.LayerTypes; filter: SilkEntity.Filter }

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
    default: {
      return <>🤔</>
    }
  }
}

const BloomSetting = ({ layer, filter }: Props) => {
  const { executeOperation } = useFleurContext()

  // const handleChange = useCallback(() => {
  //   editorActions.updateFilter(layer.id, filter.id, (filter) => {})
  // }, [layer, filter])

  const handleChangeComplete = useCallback(() => {
    executeOperation(editorOps.rerenderCanvas)
  }, [])

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

  const handleChangeRadius = useCallback((value: number) => {
    executeOperation(editorOps.updateFilter, layer.id, filter.id, (filter) => {
      filter.settings.radius = value
    })
  }, [])

  const handleChangePower = useCallback((value: number) => {
    executeOperation(editorOps.updateFilter, layer.id, filter.id, (filter) => {
      filter.settings.power = value
    })
  }, [])

  const handleChangeComplete = useCallback(() => {
    executeOperation(editorOps.rerenderCanvas)
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

  const handleChangeDistance = useCallback((value: number) => {
    executeOperation(editorOps.updateFilter, layer.id, filter.id, (filter) => {
      filter.settings.distance = value
    })
  }, [])

  const handleChangeAngleDeg = useCallback((value: number) => {
    executeOperation(editorOps.updateFilter, layer.id, filter.id, (filter) => {
      filter.settings.angleDeg = value
    })
  }, [])

  const handleChangeComplete = useCallback(() => {
    executeOperation(editorOps.rerenderCanvas)
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

const Column = ({
  nameKey,
  value,
  filter: { filterId },
  children,
}: {
  nameKey: string
  value?: string
  filter: SilkEntity.Filter
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

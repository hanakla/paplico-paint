import { useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { useAsync } from 'react-use'
import { PapValueTypes } from '@paplico/core'
import { Document } from '@paplico/core-new'
import { css, useTheme } from 'styled-components'

import { SidebarPane } from '🙌/components/SidebarPane'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { centering } from '🙌/utils/mixins'
import { PropsOf } from '🙌/utils/types'
import { shallowEquals } from '🙌/utils/object'
import { generateBrushThumbnail } from '../helpers'
import { useFleur } from '🙌/utils/hooks'
import { BRUSH_PRESETS } from '../constants'
import { memo, useContext } from 'react'
import { PaplicoEngineContext, usePaplicoEngine } from '../contexts/engine'

export const BrushPresets = memo(function BrushPresets() {
  const { t } = useTranslation('app')
  const { execute } = useFleur()
  const engine = usePaplicoEngine()

  const handleSelectBrush = useFunk<PropsOf<typeof BrushItem>['onSelected']>(
    (settings) => {
      engine.strokeSetting = {
        ...engine.strokeSetting,
        ...settings,
      }
    }
  )

  return (
    <SidebarPane heading={'ブラシ'} container={(children) => children}>
      <div
        css={`
          display: grid;
          gap: 4px;
          padding: 4px;
          /* grid-template-columns: repeat(1, 1fr); */
          grid-template-columns: 100%;
          /* overflow: auto; */
        `}
      >
        {BRUSH_PRESETS.map((preset) => (
          <BrushItem
            key={preset.id}
            brushId={preset.brushId}
            name={t(`brushPresets.${preset.nameKey}`)}
            preset={{
              brushId: preset.brushId,
              size: preset.size,
              opacity: preset.opacity,
              specific: preset.specific,
            }}
            onSelected={handleSelectBrush}
          />
        ))}

        {/* <BrushItem
          brushId={PapBrushes.Brush.id}
          preset={{ brushId: PapBrushes.Brush.id, size: 20 }}
          onSelected={handleSelectBrush}
        />
        <BrushItem
          brushId={PapBrushes.ScatterBrush.id}
          preset={{
            brushId: PapBrushes.ScatterBrush.id,
            size: 20,
            specific: { texture: 'fadeBrush' },
          }}
          onSelected={handleSelectBrush}
        />
        <BrushItem
          brushId={PapBrushes.ScatterBrush.id}
          preset={{
            brushId: PapBrushes.ScatterBrush.id,
            size: 20,
            specific: { texture: 'pencil' },
          }}
          onSelected={handleSelectBrush}
        />
        <BrushItem
          brushId={PapBrushes.ScatterBrush.id}
          preset={{
            brushId: PapBrushes.ScatterBrush.id,
            size: 20,
            specific: { texture: 'circle' },
          }}
          onSelected={handleSelectBrush}
        /> */}
      </div>
    </SidebarPane>
  )
})

const BrushItem = memo(function BrushItem({
  brushId,
  name,
  preset,
  onSelected,
}: {
  brushId: string
  name: string
  preset: Partial<PapValueTypes.BrushSetting>
  onSelected: (setting: Partial<Document.VectorStrokeSetting>) => void
}) {
  const theme = useTheme()
  const engine = useContext(PaplicoEngineContext)

  // const { engine, currentBrushSetting } = useStore((get) => ({
  //   engine: get(EditorStore).state.engine,
  //   currentBrushSetting: { ...EditorSelector.currentBrushSetting(get) },
  // }))

  const brushSize = preset.size ?? 20

  const handleClick = useFunk(() => {
    onSelected(preset)
  })

  const { value, error } = useAsync(async () => {
    if (!engine) return null

    console.log(engine)
    return await generateBrushThumbnail(engine, brushId, {
      brushSize: 12,
      specific: preset.specific ?? null,
      size: {
        width: 96 * 2,
        height: 40 * 2,
      },
    })
  }, [engine, brushSize, brushId])

  console.log(value, error)

  const isMatchToSetting = false
  // const isMatchToSetting = currentBrushSetting
  //   ? shallowEquals(preset, currentBrushSetting)
  //   : false

  return (
    <div
      css={css`
        display: flex;
        background-color: ${rgba('#fff', 0.8)};
        color: ${({ theme }) => theme.exactColors.black60};
        border-radius: 2px;

        ${centering({ x: false, y: true })}
      `}
      onClick={handleClick}
      style={{
        color: isMatchToSetting ? theme.colors.white50 : undefined,
        background: isMatchToSetting ? theme.colors.active80 : undefined,
      }}
      tabIndex={-1}
    >
      <img
        css={`
          display: inline-block;
          width: 96px;
          margin-right: 8px;
        `}
        src={value ?? undefined}
      />
      <div>
        <div
          css={`
            display: block;
            padding: 2px 0;
          `}
        >
          {brushSize}
        </div>
        <div>{name}</div>
      </div>
    </div>
  )
})

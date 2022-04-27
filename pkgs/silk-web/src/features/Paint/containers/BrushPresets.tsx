import { useFleurContext, useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { nanoid } from 'nanoid'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { useAsync } from 'react-use'
import { SilkBrushes, SilkValue } from 'silk-core'
import { SidebarPane } from '🙌/components/SidebarPane'
import { EditorOps, EditorStore } from '🙌/domains/EditorStable'
import { centering, focusRing } from '🙌/utils/mixins'
import { lightTheme, tm } from '🙌/utils/theme'
import { PropsOf } from '🙌/utils/types'
import { generateBrushThumbnail } from '../helpers'

const presets = [
  {
    id: nanoid(),
    nameKey: 'vector',
    brushId: SilkBrushes.Brush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'circle',
      fadeWeight: 0,
      inOutInfluence: 0,
      randomRotation: 0,
      scatterRange: 0,
      pressureInfluence: 0.5,
    } as Partial<SilkBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'circle',
    brushId: SilkBrushes.ScatterBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'circle',
      fadeWeight: 0,
      inOutInfluence: 0,
      randomRotation: 0,
      scatterRange: 0,
      pressureInfluence: 0.5,
    } as Partial<SilkBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'fade',
    brushId: SilkBrushes.ScatterBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'fadeBrush',
      fadeWeight: 0,
      inOutInfluence: 0.2,
      randomRotation: 0,
      scatterRange: 0,
    } as Partial<SilkBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'pencil',
    brushId: SilkBrushes.ScatterBrush.id,
    size: 20,
    opacity: 0.8,
    specific: {
      texture: 'pencil',
      fadeWeight: 0,
      inOutInfluence: 1,
      randomRotation: 1,
      scatterRange: 0.5,
      pressureInfluence: 0.5,
    } as Partial<SilkBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'pencil-enterexit',
    brushId: SilkBrushes.ScatterBrush.id,
    size: 20,
    opacity: 1,
    specific: {
      texture: 'pencil',
      fadeWeight: 1,
      inOutInfluence: 1,
      randomRotation: 1,
      scatterRange: 1,
      pressureInfluence: 0.5,
    } as Partial<SilkBrushes.ScatterBrush.SpecificSetting>,
  },
  {
    id: nanoid(),
    nameKey: 'baribari',
    brushId: SilkBrushes.ScatterBrush.id,
    size: 20,
    opacity: 1,
    specific: {
      texture: 'baribari',
      fadeWeight: 1,
      inOutInfluence: 0,
      randomRotation: 0,
      scatterRange: 0,
      pressureInfluence: 0.5,
    } as Partial<SilkBrushes.ScatterBrush.SpecificSetting>,
  },
]

export function BrushPresets() {
  const { t } = useTranslation('app')
  const { executeOperation } = useFleurContext()

  const handleSelectBrush = useFunk<PropsOf<typeof BrushItem>['onSelected']>(
    (settings) => {
      executeOperation(EditorOps.setBrushSetting, settings)
    }
  )

  return (
    <SidebarPane heading={'ブラシ'} container={(children) => children}>
      <div
        css={`
          display: grid;
          gap: 4px;
          padding: 4px;
          grid-template-columns: repeat(1, 1fr);
          /* overflow: auto; */
        `}
      >
        {presets.map((preset) => (
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
          brushId={SilkBrushes.Brush.id}
          preset={{ brushId: SilkBrushes.Brush.id, size: 20 }}
          onSelected={handleSelectBrush}
        />
        <BrushItem
          brushId={SilkBrushes.ScatterBrush.id}
          preset={{
            brushId: SilkBrushes.ScatterBrush.id,
            size: 20,
            specific: { texture: 'fadeBrush' },
          }}
          onSelected={handleSelectBrush}
        />
        <BrushItem
          brushId={SilkBrushes.ScatterBrush.id}
          preset={{
            brushId: SilkBrushes.ScatterBrush.id,
            size: 20,
            specific: { texture: 'pencil' },
          }}
          onSelected={handleSelectBrush}
        />
        <BrushItem
          brushId={SilkBrushes.ScatterBrush.id}
          preset={{
            brushId: SilkBrushes.ScatterBrush.id,
            size: 20,
            specific: { texture: 'circle' },
          }}
          onSelected={handleSelectBrush}
        /> */}
      </div>
    </SidebarPane>
  )
}

const BrushItem = ({
  brushId,
  name,
  preset,
  onSelected,
}: {
  brushId: string
  name: string
  preset: Partial<SilkValue.BrushSetting>
  onSelected: (setting: Partial<SilkValue.BrushSetting>) => void
}) => {
  const engine = useStore((get) => get(EditorStore).state.engine)

  const brushSize = preset.size ?? 20

  const handleDoubleClick = useFunk(() => {
    onSelected(preset)
  })

  const { value, loading } = useAsync(async () => {
    if (!engine) return null
    return await generateBrushThumbnail(engine, brushId, {
      brushSize: 6,
      specific: preset.specific ?? null,
      size: {
        width: 96 * 2,
        height: 40 * 2,
      },
    })
  }, [engine, brushSize, brushId])

  return (
    <div
      css={`
        display: flex;
        /* height: 56px; */
        background-color: ${rgba('#fff', 0.7)};
        color: ${lightTheme.exactColors.black10};
        border-radius: 2px;

        ${centering({ x: false, y: true })}
        ${focusRing}
      `}
      onDoubleClick={handleDoubleClick}
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
}

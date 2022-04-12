import { useFleurContext, useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'
import { rgba } from 'polished'
import { useAsync } from 'react-use'
import { SilkBrushes, SilkValue } from 'silk-core'
import { SidebarPane } from '🙌/components/SidebarPane'
import { EditorOps, EditorStore } from '🙌/domains/EditorStable'
import { focusRing } from '🙌/utils/mixins'
import { lightTheme, tm } from '🙌/utils/theme'
import { PropsOf } from '🙌/utils/types'
import { generateBrushThumbnail } from '../helpers'

export function BrushPresets() {
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
          grid-template-columns: repeat(4, 1fr);
          /* overflow: auto; */
        `}
      >
        <BrushItem
          brushId={SilkBrushes.Brush.id}
          previewBrushSize={20}
          preset={{ brushId: SilkBrushes.Brush.id, size: 2 }}
          onSelected={handleSelectBrush}
        />
        <BrushItem
          brushId={SilkBrushes.ScatterBrush.id}
          previewBrushSize={20}
          preset={{ brushId: SilkBrushes.ScatterBrush.id, size: 2 }}
          onSelected={handleSelectBrush}
        />
      </div>
    </SidebarPane>
  )
}

const BrushItem = ({
  brushId,
  previewBrushSize: brushSize,
  preset,
  onSelected,
}: {
  brushId: string
  previewBrushSize: number
  preset: Partial<SilkValue.BrushSetting>
  onSelected: (setting: Partial<SilkValue.BrushSetting>) => void
}) => {
  const engine = useStore((get) => get(EditorStore).state.engine)

  const handleDoubleClick = useFunk(() => {
    onSelected(preset)
  })

  const { value, loading } = useAsync(async () => {
    if (!engine) return null
    return await generateBrushThumbnail(engine, brushId, {
      brushSize,
      size: {
        width: 40,
        height: 40,
      },
    })
  }, [engine, brushSize, brushId])

  return (
    <div
      css={`
        display: block;
        /* height: 56px; */
        background-color: ${rgba('#fff', 0.7)};
        text-align: center;
        border-radius: 2px;

        ${focusRing}
      `}
      onDoubleClick={handleDoubleClick}
      tabIndex={-1}
    >
      <img src={value ?? undefined} />
      <span
        css={`
          display: block;
          padding: 2px 0;
          color: ${lightTheme.exactColors.black10};
        `}
      >
        {brushSize}
      </span>
    </div>
  )
}

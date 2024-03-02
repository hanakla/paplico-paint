import { CircleBrush } from '@/Brushes'
import { VisuFilter } from '@/Document'
import { PlainInk } from '@/Inks'

export const DEFAULT_FILL_SETTING =
  (): Readonly<VisuFilter.Structs.FillSetting> => ({
    type: 'fill',
    color: {
      r: 0,
      g: 0,
      b: 0,
    },
    opacity: 1,
  })

export const DEFAULT_BRUSH_SETTING = (): Readonly<
  VisuFilter.Structs.BrushSetting<CircleBrush.Settings>
> => ({
  brushId: CircleBrush.metadata.id,
  brushVersion: CircleBrush.metadata.version,
  color: {
    r: 0,
    g: 0,
    b: 0,
  },
  opacity: 1,
  size: 10,
  settings: {
    lineCap: 'round',
  },
})

export const DEFAULT_INK_SETTING = (): Readonly<
  VisuFilter.Structs.InkSetting<PlainInk.Setting>
> => ({
  inkId: PlainInk.metadata.id,
  inkVersion: PlainInk.metadata.version,
  settings: {},
})

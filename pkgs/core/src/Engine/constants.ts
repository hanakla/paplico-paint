import { CircleBrush } from '@/Brushes'
import { Paplico } from '@/Engine/Paplico'
import { PlainInk } from '@/Inks'

export const DEFAULT_FILL_SETTING = (): Readonly<Paplico.FillSetting> => ({
  type: 'fill',
  color: {
    r: 0,
    g: 0,
    b: 0,
  },
  opacity: 1,
})

export const DEFAULT_STROKE_SETTING = (): Readonly<Paplico.StrokeSetting> => ({
  brushId: CircleBrush.metadata.id,
  brushVersion: CircleBrush.metadata.version,
  color: {
    r: 0,
    g: 0,
    b: 0,
  },
  opacity: 1,
  size: 10,
  settings: {},
})

export const DEFAULT_INK_SETTING = (): Readonly<Paplico.InkSetting> => ({
  inkId: PlainInk.metadata.id,
  inkVersion: PlainInk.metadata.version,
  specific: {},
})

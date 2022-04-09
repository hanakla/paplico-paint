import { minOps } from '@fleur/fleur'

export const [PresetsStore, PresetsOps] = minOps('Presets', {
  initialState: () => ({}),
  ops: {},
})

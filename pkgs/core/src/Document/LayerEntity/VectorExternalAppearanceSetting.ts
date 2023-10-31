import { LayerFilter } from '../LayerFilter'

export type VectorExternalAppearanceSetting<T extends Record<string, any>> =
  Omit<LayerFilter<T>, 'enabled'>

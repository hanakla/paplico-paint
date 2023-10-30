import { LayerEntity } from '@/Document'

export type RuntimeLayerEntity = {
  lastUpdated: number
  source: WeakRef<LayerEntity>
}

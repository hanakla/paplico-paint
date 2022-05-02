import { PapDOM } from '@paplico/core'
import { calcLayerMove, flattenLayers } from './helpers'

describe('Paint/helpers', () => {
  const structure = [
    PapDOM.VectorLayer.create({ name: 'root-1' }),
    PapDOM.GroupLayer.create({
      name: 'root-2-group',
      layers: [
        PapDOM.VectorLayer.create({ name: 'group-1' }),
        PapDOM.VectorLayer.create({ name: 'group-2' }),
      ],
    }),
    PapDOM.VectorLayer.create({ name: 'root-3' }),
  ] as const
  const flatten = flattenLayers(structure as unknown as PapDOM.LayerTypes[])

  describe('calcLayerMove', () => {
    calcLayerMove(flatten, {
      active: { id: structure[1].layers[1].uid },
      target: { id: structure[1].uid },
    })
  })
})

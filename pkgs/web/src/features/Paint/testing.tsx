import { PapDOM } from '@paplico/core'
import { useEffect } from 'react'
import { describe, it } from '../Debug/clientSpec'
import { calcLayerMove, flattenLayers } from './helpers'

export const Testing = () => {
  useEffect(() => {
    try {
      console.group('testing')

      describe('calcLayerMove', () => {
        describe('Move to out of group', () => {
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

          const flatten = flattenLayers(
            structure as unknown as PapDOM.LayerTypes[]
          )

          const result = calcLayerMove(flatten, {
            active: { id: structure[1].layers[1].uid },
            over: { id: structure[1].uid },
          })

          it('sourcePath')
            .expect(result?.sourcePath)
            .toEqual([structure[1].uid, structure[1].layers[1].uid])
          it('targetIndex').expect(result?.targetIndex).toEqual(1)
          it('targetParentPath').expect(result?.targetParentPath).toEqual([])
        })

        describe('Move to inside of group', () => {
          const structure = [
            PapDOM.VectorLayer.create({ name: 'root-1' }),
            PapDOM.GroupLayer.create({
              name: 'root-2-group',
              layers: [
                PapDOM.VectorLayer.create({ name: 'group-1' }),
                PapDOM.VectorLayer.create({ name: 'group-2' }),
              ],
            }),
          ] as const

          const flatten = flattenLayers(
            structure as unknown as PapDOM.LayerTypes[]
          )

          const result = calcLayerMove(flatten, {
            active: { id: structure[0].uid },
            over: { id: structure[1].layers[1].uid },
          })

          it('sourcePath')
            .expect(result?.sourcePath)
            .toEqual([structure[0].uid])
          it('targetIndex').expect(result?.targetIndex).toEqual(1)
          it('targetParentPath')
            .expect(result?.targetParentPath)
            .toEqual([structure[1].uid])
        })
      })

      console.groupEnd()
    } catch (e) {}
  }, [])

  return null
}

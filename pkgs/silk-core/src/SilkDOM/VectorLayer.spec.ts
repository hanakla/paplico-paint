import { VectorLayer } from './VectorLayer'

describe('VectorLayer', () => {
  describe('transaction', () => {
    it('rollback', () => {
      const layer = VectorLayer.create({})

      const transaction = layer.createTransaction()
      const source = { ...layer }
      // console.log(source)

      transaction.update((l) => {
        l.x = 10
      })

      expect(layer.x).not.toEqual(source.x)

      transaction.rollback()

      expect(layer.x).toEqual(source.x)
    })
  })
})

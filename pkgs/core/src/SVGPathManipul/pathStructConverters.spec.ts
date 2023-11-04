import { TypeStrictVectorPathPoint } from '@/Document/LayerEntity/VectorPath'
import { vectorPathPointsToSVGCommandArray } from './pathStructConverters'

describe('pathStructConverters', () => {
  describe('vectorPathPointsToSVGCommandArray', () => {
    it('works?', () => {
      const points: TypeStrictVectorPathPoint[] = [
        { isMoveTo: true, x: 0, y: 0 },
        { x: 10, y: 10, begin: { x: 5, y: 5 }, end: { x: 5, y: 5 } },
        { x: 20, y: 20, begin: null, end: null },
        { isClose: true, x: 0, y: 0 },
      ]

      const result = vectorPathPointsToSVGCommandArray(points)

      expect(result).toMatchObject([
        ['M', 0, 0],
        ['C', 5, 5, 5, 5, 10, 10],
        ['C', 10, 10, 20, 20, 20, 20],
        ['Z'],
      ])
    })
  })
})

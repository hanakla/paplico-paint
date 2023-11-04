import { indexedPointAtLength } from '@/ext-brush'
import { getTangent } from './getTangent'

describe('getTangentAt', () => {
  it('should return the tangent at the given t', () => {
    it('case1', () => {
      const pal = indexedPointAtLength('M0,0 L100,0').getSequencialReader()

      const [x1, y1] = pal.at(pal.totalLength * 0.5, { seek: true })
      const [x2, y2] = pal.at(pal.totalLength * (0.5 + 0.0001), { seek: false })
      const tangent = getTangent(x1, y1, x2, y2)

      expect(tangent.x).toBe(1)
      expect(tangent.y).toBe(0)
    })

    it('case2', () => {
      const pal = indexedPointAtLength('M0,0 L100,100').getSequencialReader()

      const [x1, y1] = pal.at(pal.totalLength * 0.5, { seek: true })
      const [x2, y2] = pal.at(pal.totalLength * (0.5 + 0.0001), { seek: false })
      const tangent = getTangent(x1, y1, x2, y2)

      expect(tangent.x).toBeCloseTo(0.7071067811865475)
      expect(tangent.y).toBeCloseTo(0.7071067811865475)
    })
  })
})

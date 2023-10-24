import { interpolateMap } from '@/Math'
import { UIStroke } from './UIStroke'

describe('UIStroke', () => {
  describe('toSimplifiedPath', () => {
    it('should return simplified path', () => {
      const stroke = new UIStroke()
      const xMap = interpolateMap([0, 100, 50, 200, 120])
      const yMap = interpolateMap([0, 100, 100, 200, 150])

      for (let i = 0; i < 100; i++) {
        const t = i / 100
        stroke.addPoint({
          x: xMap(t),
          y: yMap(t),
          tilt: null,
          deltaTimeMs: 0,
          pressure: 1,
        })
      }

      const path = stroke.toSimplifiedPath({ tolerance: 0.1 })
      console.log(path)
    })
  })
})

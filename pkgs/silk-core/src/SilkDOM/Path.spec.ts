import { Path } from './Path'

describe('Path', () => {
  describe('getPressureAtLength', () => {
    it('works', () => {
      const p = Path.create({
        points: [
          { x: 0, y: 0, in: null, out: null, pressure: 0 },
          { x: 1, y: 0, in: null, out: null, pressure: 1 },
        ],
        closed: false,
      })

      // console.log(p.getTotalLength())
      expect(p.getPressureAt(0)).toBe(0)
      expect(p.getPressureAt(0.5)).toBe(0.5)
      expect(p.getPressureAt(1)).toBe(1)
    })
  })
})

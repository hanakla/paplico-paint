import { mapLinear } from './math'

describe('mapLinear', () => {
  it('should map linearly', () => {
    expect(mapLinear(0.5, [0, 1], [0, 10])).toBe(5)

    expect(mapLinear(50, [0, 100], [-1, 1])).toBe(0)
    expect(mapLinear(25, [0, 100], [1, -1])).toBe(0.5)

    expect(mapLinear(500, [0, 1000], [-500, 500])).toBe(0)
    expect(mapLinear(500, [0, 1000], [500, -500])).toBe(0)
  })
})

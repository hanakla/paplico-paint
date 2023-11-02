import { interpolateMap, mapLinear } from './interpolation'

describe('interpolateMap', () => {
  it('should interpolate', () => {
    const map = interpolateMap([0, 1, 2])

    expect(map(0)).toBe(0)
    expect(map(0.25)).toBe(0.5)
    expect(map(0.5)).toBe(1)
    expect(map(1)).toBe(2)
  })

  it('with t', () => {
    const map = interpolateMap([0, 1, 2])

    expect(map(0)).toBe(0)
    expect(map(0.25)).toBe(0.5)
    expect(map(0.5)).toBe(1)
    expect(map(1)).toBe(2)
  })

  it('with idx', () => {
    const map = interpolateMap([0, 1, 2])

    expect(map.byIndex(0)).toBe(0)
    expect(map.byIndex(0.5)).toBe(0.5)
    expect(map.byIndex(1)).toBe(1)
    expect(map.byIndex(1.5)).toBe(1.5)
    expect(map.byIndex(2)).toBe(2)
  })
})

describe('mapLinear', () => {
  it('should map linearly', () => {
    expect(mapLinear(0.5, [0, 1], [0, 10])).toBe(5)

    expect(mapLinear(50, [0, 100], [-1, 1])).toBe(0)
    expect(mapLinear(25, [0, 100], [1, -1])).toBe(0.5)

    expect(mapLinear(500, [0, 1000], [-500, 500])).toBe(0)
    expect(mapLinear(500, [0, 1000], [500, -500])).toBe(0)
  })
})

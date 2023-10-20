import { interpolateMap } from './interpolation'

describe('interpolateMap', () => {
  it('should interpolate', () => {
    const map = interpolateMap([0, 1, 2])

    expect(map(0)).toBe(0)
    expect(map(0.25)).toBe(0.5)
    expect(map(0.5)).toBe(1)
    expect(map(1)).toBe(2)
  })
})

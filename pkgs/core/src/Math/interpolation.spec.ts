import {
  createNumSequenceMap,
  createObjectSequenceMap,
  mapLinear,
} from './interpolation'

describe('createNumbersInterpolationMap', () => {
  it('should interpolate', () => {
    const seqlerp = createNumSequenceMap([0, 1, 2])

    expect(seqlerp.atFrac(0)).toBe(0)
    expect(seqlerp.atFrac(0.25)).toBe(0.5)
    expect(seqlerp.atFrac(0.5)).toBe(1)
    expect(seqlerp.atFrac(1)).toBe(2)
  })

  it('with t', () => {
    const seqlerp = createNumSequenceMap([0, 1, 2])

    expect(seqlerp.atFrac(0)).toBe(0)
    expect(seqlerp.atFrac(0.25)).toBe(0.5)
    expect(seqlerp.atFrac(0.5)).toBe(1)
    expect(seqlerp.atFrac(1)).toBe(2)
  })

  it('with idx', () => {
    const seqlerp = createNumSequenceMap([0, 1, 2])

    expect(seqlerp.atIndex(0)).toBe(0)
    expect(seqlerp.atIndex(0.5)).toBe(0.5)
    expect(seqlerp.atIndex(1)).toBe(1)
    expect(seqlerp.atIndex(1.5)).toBe(1.5)
    expect(seqlerp.atIndex(2)).toBe(2)
  })
})

describe('createObjectsInterpolationMap', () => {
  it('should interpolate', () => {
    const array = [{ num: 0 }, { num: 1 }, { num: 2 }]
    const objLerbMap = createObjectSequenceMap(array, (i, list) => list[i].num)

    expect(objLerbMap.atFrac(0)).toBe(0)
    expect(objLerbMap.atFrac(0.5)).toBe(1)
    expect(objLerbMap.atFrac(1)).toBe(2)
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

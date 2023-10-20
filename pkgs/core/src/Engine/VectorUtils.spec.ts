import { pointsToSVGCommandArray } from './VectorUtils'

describe('pointsToSVGCommandArray', () => {
  it('works', () => {
    const result = pointsToSVGCommandArray(
      [
        { x: 0, y: 0, end: null, begin: null },
        { x: 0.6, y: 0.6, end: { x: 0, y: 0.5 }, begin: { x: 0.5, y: 0.5 } },
        { x: 1, y: 1, end: null, begin: null }
      ],
      false
    )

    expect(result).toEqual([
      ['M', 0, 0],
      ['C', 0, 0.5, 0.5, 0.5, 0.6, 0.6],
      ['L', 1, 1]
    ])
  })
})

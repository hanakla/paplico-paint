import { createVectorPath } from './Document'
import {
  indexedPointAtLength,
  pointsToSVGCommandArray,
  scatterPlot,
  getTangent,
} from './stroking-utils'
import { FuncStats } from './utils/perfstats'

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

describe('scatterPlot', () => {
  it('test', () => {
    const path = createVectorPath({
      closed: false,
      randomSeed: 0,
      points: [
        { x: 0, y: 0, end: null, begin: null, pressure: 1 },
        { x: 10, y: 10, end: null, begin: null, pressure: 0 },
      ],
    })

    const pal = indexedPointAtLength(
      pointsToSVGCommandArray(path.points, false),
    )

    const result = scatterPlot(path, pal, {
      counts: 10,
      scatterRange: 0,
      scatterScale: 0,
    })

    FuncStats.clearStats(scatterPlot)
  })

  it('bench', () => {
    const POINTS = 1000

    const path = createVectorPath({
      closed: false,
      randomSeed: 0,
      points: Array.from({ length: POINTS }, (_, i) => ({
        x: i,
        y: i,
        in: null,
        out: null,
        pressure: 1,
      })),
    })

    const pal = indexedPointAtLength(
      pointsToSVGCommandArray(path.points, false),
    )

    console.time('scatterPlot once')
    scatterPlot(path, pal, {
      counts: POINTS,
      scatterRange: 0,
      scatterScale: 0,
    })
    console.timeEnd('scatterPlot once')

    // FuncStats.getStats(scatterPlot)?.log()
    // FuncStats.clearStats(scatterPlot)
  })
})

describe('pointsToSVGCommandArray', () => {
  it('works', () => {
    const result = pointsToSVGCommandArray(
      [
        { x: 0, y: 0, end: null, begin: null },
        { x: 0.6, y: 0.6, end: { x: 0, y: 0.5 }, begin: { x: 0.5, y: 0.5 } },
        { x: 1, y: 1, end: null, begin: null },
      ],
      false,
    )

    expect(result).toEqual([
      ['M', 0, 0],
      ['C', 0, 0.5, 0.5, 0.5, 0.6, 0.6],
      ['L', 1, 1],
    ])
  })
})

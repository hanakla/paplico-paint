import { createVectorPath } from './Document'
import {
  indexedPointAtLength,
  vectorPathPointsToSVGPathString,
  scatterPlot,
  vectorPathPointsToSVGDCommandArray,
} from './index-ext-brush'
import { FuncStats } from './utils/perfstats'

describe('scatterPlot', () => {
  it('test', () => {
    const path = createVectorPath({
      randomSeed: 0,
      points: [
        { isMoveTo: true, x: 0, y: 0 },
        { x: 10, y: 10, end: null, begin: null, pressure: 0 },
      ],
    })

    const pal = indexedPointAtLength(
      vectorPathPointsToSVGPathString(path.points),
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
      randomSeed: 0,
      points: Array.from({ length: POINTS }, (_, i) => ({
        ...(i === 0 ? { isMoveTo: true } : {}),
        x: i,
        y: i,
        in: null,
        out: null,
        pressure: 1,
      })),
    })

    const pal = indexedPointAtLength(
      vectorPathPointsToSVGPathString(path.points),
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
    const result = vectorPathPointsToSVGDCommandArray([
      { isMoveTo: true, x: 0, y: 0 },
      { x: 0.6, y: 0.6, begin: { x: 0.5, y: 0.5 }, end: { x: 0, y: 0.5 } },
      { x: 1, y: 1, end: null, begin: null },
    ])

    expect(result).toEqual([
      ['M', 0, 0],
      ['C', 0.5, 0.5, 0, 0.5, 0.6, 0.6],
      ['L', 1, 1],
    ])
  })
})

import fastRandom from 'fast-random'
import { rgb } from 'polished'
import { VectorPath, VectorPathPoint } from '@/Document/LayerEntity/VectorPath'
import {
  IndexedPointAtLength,
  indexedPointAtLength,
  SequencialPointAtLength,
} from './fastsvg/CachedPointAtLength'
import { pointsToSVGCommandArray, pointsToSVGPath } from './Engine/VectorUtils'
import { ColorRGB, createVectorPath } from './Document'
import { interpolateMap, interpolateMapObject, lerp } from './Math'
import { FuncStats } from './utils/perfstats'
import { degToRad, radToDeg } from './utils/math'

export { setCanvasSize } from '@/utils/canvas'
export { mapPoints } from './Engine/VectorUtils'

// type ScatteredPoint = VectorPathPoint & {}

export const rgbToHexColor = (color: ColorRGB) => {
  return rgb(color.r * 255, color.g * 255, color.b * 255)
}

const getTangentAt = (pal: SequencialPointAtLength, t: number) => {
  const stat = FuncStats.start(scatterPlot)

  const [x1, y1] = pal.at(pal.totalLength * t, { seek: true })
  const [x2, y2] = pal.at(pal.totalLength * (t + 0.0001), { seek: false })

  const vector = { x: x2 - x1, y: y2 - y1 }
  const magnitude = Math.hypot(vector.x, vector.y)

  vector.x /= magnitude
  vector.y /= magnitude

  stat.finish()
  return vector
}

export const getRadianFromTangent = (
  pt1: { x: number; y: number },
  pt2: { x: number; y: number }
) => {
  const vector = { x: pt2.x - pt1.x, y: pt2.y - pt1.y }
  const magnitude = Math.hypot(vector.x, vector.y)

  vector.x /= magnitude
  vector.y /= magnitude

  return Math.atan2(vector.x, vector.y)
}

type ScatteredPoint = VectorPathPoint & {
  /** 1 is straight size */
  scale: number
  /** radian */
  rotate: number
}

export const scatterPlot = (
  path: VectorPath,
  {
    counts,
    scatterRange,
    scatterScale = 0,
    useTangent = false,
    divisions,
  }: {
    counts: number
    scatterRange: number
    /** 0 is disabled to scaling */
    scatterScale: number
    useTangent?: boolean
    divisions?: number
  }
): Array<ScatteredPoint> => {
  const stat = FuncStats.start(scatterPlot)

  var end = stat.time('seqPal build')
  const seqPal = indexedPointAtLength(
    pointsToSVGCommandArray(path.points, path.closed),
    divisions
  ).getSequencialReader()
  end()

  const posRandom = fastRandom(path.randomSeed)
  const rotationRandom = fastRandom(path.randomSeed + 0x5235dfac)
  const scaleRandom = fastRandom(path.randomSeed + 0x2435ffab)

  end = stat.time('interpolateMap build')
  const getPressureAt = interpolateMapObject(path.points,  (idx, arr) => arr[idx].pressure ?? 1) // prettier-ignore
  const getDeltaAt = interpolateMapObject(path.points,  (idx, arr) => arr[idx].deltaTime ?? 0) // prettier-ignore
  const getTiltXAt = interpolateMapObject(path.points,  (idx, arr) => arr[idx].tilt?.x ?? 0) // prettier-ignore
  const getTiltYAt = interpolateMapObject(path.points,  (idx, arr) => arr[idx].tilt?.y ?? 0) // prettier-ignore
  end()

  scatterRange /= 2

  end = stat.time('scatter plot')
  const points: ScatteredPoint[] = []
  const perLength = 1 / (counts - 1)
  for (let i = 0; i < counts; i++) {
    const frac = i * perLength

    let [x, y] = seqPal.at(seqPal.totalLength * frac)
    // Number.isNaN(x) && console.log({ x, y, frac })

    if (useTangent) {
      const tan = getTangentAt(seqPal, frac)
      const rad = Math.atan2(tan.x, tan.y) + degToRad(90)

      x += lerp(-scatterRange, scatterRange, Math.cos(rad))
      y += lerp(-scatterRange, scatterRange, Math.sin(rad))
    } else {
      x += lerp(-scatterRange, scatterRange, posRandom.nextFloat())
      y += lerp(-scatterRange, scatterRange, posRandom.nextFloat())
    }

    var plotEnd = stat.time('plot')
    points.push({
      in: null,
      out: null,
      x: x,
      y: y,
      deltaTime: getDeltaAt(frac),
      pressure: getPressureAt(frac),
      tilt: {
        x: getTiltXAt(frac),
        y: getTiltYAt(frac),
      },
      rotate: degToRad(rotationRandom.nextFloat() * 360),
      scale:
        1 + lerp(-scatterScale / 2, scatterScale / 2, scaleRandom.nextFloat()),
    })
    plotEnd()
  }
  end()

  stat.finish()
  return points
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest!

  describe('getTangentAt', () => {
    it('should return the tangent at the given t', () => {
      it('case1', () => {
        const pal = indexedPointAtLength('M0,0 L100,0').getSequencialReader()
        const tangent = getTangentAt(pal, 0.5)

        expect(tangent.x).toBe(1)
        expect(tangent.y).toBe(0)
      })

      it('case2', () => {
        const pal = indexedPointAtLength('M0,0 L100,100').getSequencialReader()
        const tangent = getTangentAt(pal, 0.5)

        expect(tangent.x).toBeCloseTo(0.7071067811865475)
        expect(tangent.y).toBeCloseTo(0.7071067811865475)
      })
    })
  })

  describe('scatterPlot', () => {
    it('test', () => {
      const result = scatterPlot(
        createVectorPath({
          closed: false,
          randomSeed: 0,
          points: [
            { x: 0, y: 0, in: null, out: null, pressure: 1 },
            { x: 10, y: 10, in: null, out: null, pressure: 0 },
          ],
        }),
        { counts: 10, scatterRange: 0, scatterScale: 0, divisions: 50 }
      )

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

      console.time('scatterPlot once')
      scatterPlot(path, {
        counts: POINTS,
        scatterRange: 0,
        scatterScale: 0,
        divisions: 50,
      })
      console.timeEnd('scatterPlot once')

      // FuncStats.getStats(scatterPlot)?.log()
      // FuncStats.clearStats(scatterPlot)
    })
  })
}

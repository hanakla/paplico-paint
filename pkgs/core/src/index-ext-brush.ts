/** Utility functions for making custom brush */

import fastRandom from 'fast-random'
import { rgb } from 'polished'
import {
  IndexedPointAtLength,
  indexedPointAtLength,
  SequencialPointAtLength,
  SVGDCommand,
} from './fastsvg/IndexedPointAtLength'
import { ColorRGB, VisuElement } from './Document'
import {
  createNumSequenceMap,
  createObjectSequenceMap,
  getTangent,
  lerp,
} from './Math'
import { FuncStats } from './utils/perfstats'
import { degToRad } from './utils/math'

export { PPLCAbortError as PaplicoAbortError } from '@/Errors/PPLCPaplicoAbortError'
export {
  createBrush,
  type IBrush,
  type BrushMetadata,
  type BrushContext,
  type BrushPaneContext,
  type BrushClass,
  type BrushLayoutData,
} from './Engine/Brush/Brush'

export {
  vectorPathPointsToSVGPath as vectorPathPointsToSVGPathString,
  vectorPathPointsToSVGCommandArray as vectorPathPointsToSVGDCommandArray,
  svgDCommandArrayToSVGPath as svgDCommandArrayToSVGPathString,
} from './SVGPathManipul/index'
export { getRadianFromTangent } from '@/Math/getRadianFromTangent'

export {
  createNumSequenceMap as interpolateMap,
  createObjectSequenceMap as interpolateMapObject,
  indexedPointAtLength,
  type IndexedPointAtLength,
  type SVGDCommand,
}

export * as CanvasUtil from '@/utils/canvas'

export const rgbToHexColorString = (color: ColorRGB) => {
  return rgb(color.r * 255, color.g * 255, color.b * 255)
}

type ScatteredPoint = VisuElement.VectorPathPoint & {
  /** 1 is straight size */
  scale: number
  /** radian */
  rotate: number
}

export const createStreamScatter = (
  path: VisuElement.VectorPath,
  pal: IndexedPointAtLength,
  {
    scatterRange,
    scatterScale = 0,

    useTangent = false,
  }: {
    counts: number
    scatterRange: number
    /** 0 is disabled to scaling */
    scatterScale: number
    useTangent?: boolean
  },
) => {
  const stat = FuncStats.start(createStreamScatter)

  let timeEnd = stat.time('seqPal build')
  // const seqPal = pal.getSequencialReader()
  timeEnd()

  const posRandom = fastRandom(path.randomSeed)
  const rotationRandom = fastRandom(path.randomSeed + 0x5235dfac)
  const scaleRandom = fastRandom(path.randomSeed + 0x2435ffab)

  timeEnd = stat.time('interpolateMap build')
  const getPressureAt = createObjectSequenceMap(path.points, (idx, arr) => arr[idx].pressure ?? 1) // prettier-ignore
  const getDeltaAt = createObjectSequenceMap(path.points, (idx, arr) => arr[idx].deltaTime ?? 0) // prettier-ignore
  const getTiltXAt = createObjectSequenceMap(path.points, (idx, arr) => arr[idx].tilt?.x ?? 0) // prettier-ignore
  const getTiltYAt = createObjectSequenceMap(path.points, (idx, arr) => arr[idx].tilt?.y ?? 0) // prettier-ignore
  timeEnd()

  const _scatterRange = (scatterRange /= 2)

  return {
    scatterPoint: (x: number, y: number, frac: number) => {
      timeEnd = stat.time('scatter plot')

      if (useTangent) {
        const [p1, p2] = pal.atBatch([
          pal.totalLength * frac,
          pal.totalLength * (frac + 0.0001),
        ])
        const tan = getTangent(p1.pos[0], p1.pos[1], p2.pos[0], p2.pos[1])
        const rad = Math.atan2(tan.x, tan.y) + degToRad(90)

        x += lerp(-_scatterRange, _scatterRange, Math.cos(rad))
        y += lerp(-_scatterRange, _scatterRange, Math.sin(rad))
      } else {
        x += lerp(-_scatterRange, _scatterRange, posRandom.nextFloat())
        y += lerp(-_scatterRange, _scatterRange, posRandom.nextFloat())
      }

      const plotEnd = stat.time('plot')

      const result = {
        x: x,
        y: y,
        deltaTime: getDeltaAt.atFrac(frac),
        pressure: getPressureAt.atFrac(frac),
        tilt: {
          x: getTiltXAt.atFrac(frac),
          y: getTiltYAt.atFrac(frac),
        },
        /** radians */
        rotate: degToRad(rotationRandom.nextFloat() * 360),
        scale:
          1 +
          lerp(-scatterScale / 2, scatterScale / 2, scaleRandom.nextFloat()),
      }
      plotEnd()
      timeEnd()

      stat.finish()
      return result
    },
  }
}

/** @deprecated */
export const scatterPlot = (
  path: VisuElement.VectorPath,
  pal: IndexedPointAtLength,
  {
    counts,
    scatterRange,
    scatterScale = 0,
    useTangent = false,
  }: {
    counts: number
    scatterRange: number
    /** 0 is disabled to scaling */
    scatterScale: number
    useTangent?: boolean
  },
): Array<ScatteredPoint> => {
  const stat = FuncStats.start(scatterPlot)

  let timeEnd = stat.time('seqPal build')
  const seqPal = pal.getSequencialReader()
  timeEnd()

  const posRandom = fastRandom(path.randomSeed)
  const rotationRandom = fastRandom(path.randomSeed + 0x5235dfac)
  const scaleRandom = fastRandom(path.randomSeed + 0x2435ffab)

  timeEnd = stat.time('interpolateMap build')
  const getPressureAt = createObjectSequenceMap(path.points,  (idx, arr) => arr[idx].pressure ?? 1) // prettier-ignore
  const getDeltaAt = createObjectSequenceMap(path.points,  (idx, arr) => arr[idx].deltaTime ?? 0) // prettier-ignore
  const getTiltXAt = createObjectSequenceMap(path.points,  (idx, arr) => arr[idx].tilt?.x ?? 0) // prettier-ignore
  const getTiltYAt = createObjectSequenceMap(path.points,  (idx, arr) => arr[idx].tilt?.y ?? 0) // prettier-ignore
  timeEnd()

  scatterRange /= 2

  timeEnd = stat.time('scatter plot')

  const requests: number[] = []
  for (let i = 0; i < counts; i++) requests.push(pal.totalLength * (i / counts))
  const lengths = pal.atBatch(requests)

  const points: ScatteredPoint[] = []
  const perLength = 1 / (counts - 1)
  for (let i = 0; i < counts; i++) {
    const frac = i * perLength

    let [x, y] = lengths[i].pos

    if (useTangent) {
      const tan = getTangentAt(seqPal, frac)
      const rad = Math.atan2(tan.x, tan.y) + degToRad(90)

      x += lerp(-scatterRange, scatterRange, Math.cos(rad))
      y += lerp(-scatterRange, scatterRange, Math.sin(rad))
    } else {
      x += lerp(-scatterRange, scatterRange, posRandom.nextFloat())
      y += lerp(-scatterRange, scatterRange, posRandom.nextFloat())
    }

    const plotEnd = stat.time('plot')
    points.push({
      end: null,
      begin: null,
      x: x,
      y: y,
      deltaTime: getDeltaAt.atFrac(frac),
      pressure: getPressureAt.atFrac(frac),
      tilt: {
        x: getTiltXAt.atFrac(frac),
        y: getTiltYAt.atFrac(frac),
      },
      rotate: degToRad(rotationRandom.nextFloat() * 360),
      scale:
        1 + lerp(-scatterScale / 2, scatterScale / 2, scaleRandom.nextFloat()),
    })
    plotEnd()
  }
  timeEnd()

  stat.finish()
  return points

  function getTangentAt(pal: SequencialPointAtLength, t: number) {
    const stat = FuncStats.start(scatterPlot)

    const [x1, y1] = pal.at(pal.totalLength * t, { seek: true })
    const [x2, y2] = pal.at(pal.totalLength * (t + 0.0001), { seek: false })

    stat.finish()

    return getTangent(x1, y1, x2, y2)
  }
}

import prand from 'pure-rand'
import abs from 'abs-svg-path'

import { VectorPath, VectorPathPoint } from '@/Document/LayerEntity/VectorPath'

import { interpolateMap } from '@/Math'
import { indexedPointAtLength } from '@/fastsvg/IndexedPointAtLength'
import { simplifySvgPath } from '@/VectorProcess'

export type UIStrokePoint = {
  x: number
  y: number
  /** 0 to 1, default should be 1 */
  pressure: number
  /** Milli-seconds time from stroke started */
  deltaTimeMs: number
  tilt: { x: number; y: number } | null
}

export type UIStrokePointRequired = Omit<UIStrokePoint, 'deltaTimeMs'> & {
  deltaTimeMs?: number
}

export class UIStroke {
  public startTime: number = 0
  public points: UIStrokePoint[] = []
  public randomSeed: number = prand.mersenne(Math.random()).next()[0]

  public markStartTime() {
    this.startTime = Date.now()
  }

  public addPoint(point: UIStrokePointRequired) {
    const deltaTimeMs = point.deltaTimeMs ?? Date.now() - this.startTime
    this.points.push({ ...point, deltaTimeMs })
  }

  public toPath(): VectorPath {
    return {
      points: this.points.map((p) => ({
        x: p.x,
        y: p.y,
        in: null,
        out: null,
        pressure: p.pressure,
        tilt: p.tilt
      })),
      randomSeed: this.randomSeed,
      closed: false
    }
  }

  /**
   * @param tolerance
   *  補正強度(0=なし,1=元の線に忠実,5=かなりなめらか くらいのニュアンス)
   *
   *  SEE: https://luncheon.github.io/simplify-svg-path/index.html
   */
  public toSimplefiedPath({
    tolerance = 5
  }: { tolerance?: number } = {}): VectorPath {
    const simplified = simplifySvgPath(
      this.points.map((p) => [p.x, p.y] as const),
      { closed: false, precision: 5, tolerance }
    )

    const absolutedPath = abs(simplified)
    const simplifiedPal = indexedPointAtLength(simplified)

    const deltaMap = interpolateMap(this.points.map((p) => p.deltaTimeMs))
    const pressureMap = interpolateMap(this.points.map((p) => p.pressure))
    const tiltXMap = interpolateMap(this.points.map((p) => p.tilt?.x ?? 0))
    const tiltYMap = interpolateMap(this.points.map((p) => p.tilt?.y ?? 0))

    const points = absolutedPath.map(([cmd, ...args], idx): VectorPathPoint => {
      const next = absolutedPath[idx + 1]
      const frac = simplifiedPal.lengthOfVertex(idx) / simplifiedPal.totalLength

      switch (cmd) {
        case 'M':
          return {
            x: args[0],
            y: args[1],
            begin: null,
            end: next ? { x: next[1], y: next[2] } : null,
            pressure: pressureMap(frac),
            deltaTime: deltaMap(frac),
            tilt: {
              x: tiltXMap(frac),
              y: tiltYMap(frac)
            }
          }
        case 'C':
          return {
            x: args[4],
            y: args[5],
            end: { x: args[2], y: args[3] },
            begin: next ? { x: next[1], y: next[2] } : null,
            pressure: pressureMap(frac),
            deltaTime: deltaMap(frac),
            tilt: {
              x: tiltXMap(frac),
              y: tiltYMap(frac)
            }
          }
        default: {
          throw new Error(`Unknown command: ${cmd}`)
        }
      }
    })

    return {
      points,
      randomSeed: this.randomSeed,
      closed: false,
    }
  }
}

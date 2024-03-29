import prand from 'pure-rand'
import { createNumSequenceMap } from '@/Math'
import { indexedPointAtLength } from '@/fastsvg/IndexedPointAtLength'
import { simplifySvgPath } from '@/SVGPathManipul'
import { VisuElement } from '@/Document'
import { absNormalizePath } from '@/fastsvg/absNormalizePath'

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

  public toPath(): VisuElement.VectorPath {
    return {
      fillRule: 'nonzero',
      points: this.points.map((p, idx: number): VisuElement.VectorPathPoint => {
        if (idx === 0) {
          return { isMoveTo: true, x: p.x, y: p.y }
        } else {
          return {
            x: p.x,
            y: p.y,
            begin: null,
            end: null,
            pressure: p.pressure,
            tilt: p.tilt,
          }
        }
      }),
      randomSeed: this.randomSeed,
    }
  }

  /**
   * @param tolerance
   *  補正強度(0=なし,1=元の線に忠実,5=かなりなめらか くらいのニュアンス)
   *
   *  SEE: https://luncheon.github.io/simplify-svg-path/index.html
   */
  public toSimplifiedPath({
    tolerance = 5,
  }: { tolerance?: number } = {}): VisuElement.VectorPath {
    const simplified = simplifySvgPath(
      this.points.map((p) => [p.x, p.y] as const),
      { closed: false, precision: 5, tolerance },
    )

    const absolutedPath = absNormalizePath(simplified)
    const simplifiedPal = indexedPointAtLength(absolutedPath)

    const deltaMap = createNumSequenceMap(this.points.map((p) => p.deltaTimeMs))
    const pressureMap = createNumSequenceMap(this.points.map((p) => p.pressure))
    const tiltXMap = createNumSequenceMap(
      this.points.map((p) => p.tilt?.x ?? 0),
    )
    const tiltYMap = createNumSequenceMap(
      this.points.map((p) => p.tilt?.y ?? 0),
    )

    const points = absolutedPath.map(
      ([cmd, ...args], idx): VisuElement.VectorPathPoint => {
        const frac =
          simplifiedPal.lengthOfVertex(idx) / simplifiedPal.totalLength

        switch (cmd) {
          case 'M':
            return {
              isMoveTo: true,
              x: args[0],
              y: args[1],
            }
          case 'C':
            return {
              x: args[4],
              y: args[5],
              begin: { x: args[0], y: args[1] },
              end: { x: args[2], y: args[3] },
              pressure: pressureMap.atFrac(frac),
              deltaTime: deltaMap.atFrac(frac),
              tilt: {
                x: tiltXMap.atFrac(frac),
                y: tiltYMap.atFrac(frac),
              },
            }
          case 'L':
            return {
              x: args[0],
              y: args[1],
              begin: null,
              end: null,
              pressure: pressureMap.atFrac(frac),
              deltaTime: deltaMap.atFrac(frac),
              tilt: {
                x: tiltXMap.atFrac(frac),
                y: tiltYMap.atFrac(frac),
              },
            }
          default: {
            throw new Error(`Unknown command: ${cmd}`)
          }
        }
      },
    )

    return {
      points,
      randomSeed: this.randomSeed,
      fillRule: 'nonzero',
    }
  }
}

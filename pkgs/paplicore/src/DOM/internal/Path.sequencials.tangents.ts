import { Path } from '../Path'

export const createSequencialTangentsReader = (path: Path) => {
  const totalLength = path.getTotalLength()
  const props = path.pathProps.inst

  console.log(props)
  let prevLen = 0
  let lastPartIndex = props.partial_lengths.length - 1

  const reader = {
    getTangentAt: (t: number) => {
      const len = totalLength * t
      return reader.getTangentAtLength(len)
    },
    getTangentAtLength: (fractionLength: number) => {
      if (fractionLength < prevLen) {
        throw new Error(
          `sequencialTangentAtLengthGetter: Querying length too small than previous length`
        )
      }

      // inlined getPartAtLength
      // SEE: https://github.com/rveciana/svg-path-properties/blob/master/src/svg-path-properties.ts#L308
      if (fractionLength < 0) {
        fractionLength = 0
      } else if (fractionLength > totalLength) {
        fractionLength = totalLength
      }

      let i = lastPartIndex

      while (props.partial_lengths[i] >= fractionLength && i > 0) {
        i--
      }

      i += 1
      lastPartIndex = i

      const fractionPart = {
        fraction: fractionLength - props.partial_lengths[i - 1],
        i: i,
      }

      // inlined getTangentAtLength
      // SEE: https://github.com/rveciana/svg-path-properties/blob/master/src/svg-path-properties.ts#L340
      const functionAtPart = props.functions[fractionPart.i]
      if (functionAtPart) {
        const part = functionAtPart

        // inlined Bezier.getTangentAtLength
        // SEE: https://github.com/rveciana/svg-path-properties/blob/master/src/bezier.ts#L63
        // let r = functionAtPart.getTangentAtLength(fractionPart.fraction)
        const length = fractionPart.fraction
        const xs = [part.a.x, part.b.x, part.c.x, part.d.x]
        const xy = [part.a.y, part.b.y, part.c.y, part.d.y]

        // inlined t2length
        // SEE: https://github.com/rveciana/svg-path-properties/blob/master/src/bezier-functions.ts#L143
        let t: number
        {
          let error = 1
          let tt = length / totalLength
          let step = (length - part.getArcLength(xs, xy, tt)) / totalLength

          let numIterations = 0
          while (error > 0.001) {
            const increasedTLength = part.getArcLength(xs, xy, tt + step)
            const increasedTError =
              Math.abs(length - increasedTLength) / totalLength

            if (increasedTError < error) {
              error = increasedTError
              tt += step
            } else {
              const decreasedTLength = part.getArcLength(xs, xy, tt - step)
              const decreasedTError =
                Math.abs(length - decreasedTLength) / totalLength
              if (decreasedTError < error) {
                error = decreasedTError
                tt -= step
              } else {
                step /= 2
              }
            }

            numIterations++
            if (numIterations > /* original is 500 */ 200) {
              break
            }
          }

          t = tt
        }

        const derivative = part.getDerivative(xs, xy, t)
        const mdl = Math.sqrt(
          derivative.x * derivative.x + derivative.y * derivative.y
        )
        let tangent: { x: number; y: number }
        if (mdl > 0) {
          tangent = { x: derivative.x / mdl, y: derivative.y / mdl }
        } else {
          tangent = { x: 0, y: 0 }
        }
        return tangent
      } else if (props.initial_point) {
        return { x: 0, y: 0 }
      }

      throw new Error('Wrong function at this part.')
    },
  }
}

// Original: https://github.com/rveciana/svg-path-properties/blob/master/src/bezier-functions.ts#L27

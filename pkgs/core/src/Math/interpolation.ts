import { clamp } from '@/utils/math'

type InterpolatorFunction = (a: number, b: number, ratio: number) => number

export const lerp = (a: number, b: number, t: number) => {
  return a + (b - a) * t
}

const linearInterpolation = (a: number, b: number, ratio: number) => {
  return a + (b - a) * ratio
}

export const mapLinear = (
  x: number,
  a: [number, number],
  b: [number, number],
) => {
  return lerp(b[0], b[1], clamp((x - a[0]) / (a[1] - a[0]), 0, 1))
}

export const clampNumInLength = (array: any[], num: number) => {
  // prettier-ignore
  return num < 0 ? 0 :
    num >= array.length ? array.length - 1 :
    num
}

type NumericSeqLerp = {
  /** @param t 0 to 1 number */
  atFrac: (t: number) => number
  /** @param idx Index of array accepst floating point number */
  atIndex: (index: number) => number
}

export const createNumSequenceMap = (
  numbers: number[],
  interpolate: InterpolatorFunction = linearInterpolation,
): NumericSeqLerp => {
  const indexLerp = (idx: number) => {
    const rate = idx - Math.trunc(idx)
    const index = Math.trunc(idx)

    // prettier-ignore
    const a = numbers[clampNumInLength(numbers, index)]
    const b = numbers[clampNumInLength(numbers, index + 1)]

    return interpolate(a, b, rate)
  }

  return {
    atFrac: (t: number) => indexLerp(t * (numbers.length - 1)),
    atIndex: indexLerp,
  }
}

export const createObjectSequenceMap = <T>(
  array: T[],
  picker: (index: number, array: T[]) => number,
  interpolate: InterpolatorFunction = linearInterpolation,
): NumericSeqLerp => {
  const indexLerp = (idx: number) => {
    const rate = idx - Math.trunc(idx)
    const index = Math.trunc(idx)

    const a = picker(clampNumInLength(array, index), array)
    const b = picker(clampNumInLength(array, index + 1), array)

    return interpolate(a, b, rate)
  }

  return {
    atFrac: (t: number) => indexLerp(t * (array.length - 1)),
    atIndex: indexLerp,
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest!

  describe('Math', () => {
    describe('clampIndex', () => {
      it('should clamp index', () => {
        const array = [0, 1]

        expect(clampNumInLength(array, -1)).toBe(0)
        expect(clampNumInLength(array, 0)).toBe(0)
        expect(clampNumInLength(array, 1)).toBe(1)
        expect(clampNumInLength(array, 2)).toBe(1)
      })
    })
  })
}

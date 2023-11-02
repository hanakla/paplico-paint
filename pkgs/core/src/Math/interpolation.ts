import { clamp } from '.'

type Interpolator = (a: number, b: number, ratio: number) => number

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

const clampIndex = (array: any[], index: number) => {
  // prettier-ignore
  return index < 0 ? 0 :
    index >= array.length ? array.length - 1 :
    index
}

export const interpolateMap = (
  numbers: number[],
  interpolate: Interpolator = linearInterpolation,
) => {
  const fn = (t: number) => {
    const pos = t * (numbers.length - 1)
    return fn.byIndex(pos)
  }

  fn.byIndex = (idx: number) => {
    const rate = idx - Math.trunc(idx)
    const index = Math.trunc(idx)

    // prettier-ignore
    const a = numbers[clampIndex(numbers, index)]
    const b = numbers[clampIndex(numbers, index + 1)]

    return interpolate(a, b, rate)
  }

  return fn
}

export const interpolateMapObject = <T>(
  array: T[],
  picker: (index: number, array: T[]) => number,
  interpolate: Interpolator = linearInterpolation,
) => {
  return (t: number) => {
    const pos = t * (array.length - 1)
    const rate = pos - Math.trunc(pos)
    const index = Math.trunc(pos)

    const a = picker(clampIndex(array, index), array)
    const b = picker(clampIndex(array, index + 1), array)

    return interpolate(a, b, rate)
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest!

  describe('Math', () => {
    describe('clampIndex', () => {
      it('should clamp index', () => {
        const array = [0, 1]

        expect(clampIndex(array, -1)).toBe(0)
        expect(clampIndex(array, 0)).toBe(0)
        expect(clampIndex(array, 1)).toBe(1)
        expect(clampIndex(array, 2)).toBe(1)
      })
    })

    describe('interpolateMapObject', () => {
      it('should interpolate', () => {
        const array = [0, 1, 2]
        const intelate = interpolateMapObject(array, (i) => i)

        expect(intelate(0)).toBe(0)
        expect(intelate(0.5)).toBe(1)
        expect(intelate(1)).toBe(2)
      })
    })
  })
}

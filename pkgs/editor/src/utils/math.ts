import { PaplicoMath } from '@paplico/core-new'

type Sides = 'right-top' | 'right-bottom' | 'left-top' | 'left-bottom'

export const getSidingByMovement = (
  /** movement */
  [x1, y1]: [number, number],
): Sides => {
  return getSidingByTwoPoints([0, 0], [x1, y1])
}

export const reveseSiding = (siding: Sides): Sides => {
  switch (siding) {
    case 'right-top':
      return 'left-bottom'
    case 'right-bottom':
      return 'left-top'
    case 'left-top':
      return 'right-bottom'
    case 'left-bottom':
      return 'right-top'
  }
}

export const getSidingByTwoPoints = (
  /** origin */
  [x1, y1]: [number, number],
  /** target */
  [x2, y2]: [number, number],
): Sides => {
  if (x2 > x1 && y2 > y1) return 'right-bottom'
  if (x2 > x1 && y2 < y1) return 'right-top'
  if (x2 < x1 && y2 > y1) return 'left-bottom'
  if (x2 < x1 && y2 < y1) return 'left-top'
  if (x2 === x1 && y2 > y1) return 'left-bottom'
  if (x2 === x1 && y2 < y1) return 'left-top'
  if (x2 > x1 && y2 === y1) return 'right-top'
  if (x2 < x1 && y2 === y1) return 'left-top'
  if (x2 === x1 && y2 === y1) return 'left-top'

  throw new Error('invalid siding')
}

export const flipRectOriginFromLeftTop = (
  to: Sides,
  x: number,
  y: number,
  w: number,
  h: number,
): {
  x: number
  y: number
  width: number
  height: number
} => {
  switch (to) {
    case 'right-top':
      return {
        y: y,
        x: x - w,
        width: w,
        height: h,
      }
    case 'right-bottom':
      return {
        y: y - h,
        x: x - w,
        width: w,
        height: h,
      }
    case 'left-bottom':
      return {
        y: y - h,
        x: x,
        width: w,
        height: h,
      }
    case 'left-top':
      return {
        y: y,
        x: x,
        width: w,
        height: h,
      }
  }
}

export const getTangent = PaplicoMath.getTangent

export const radToDeg = PaplicoMath.radToDeg

PaplicoMath

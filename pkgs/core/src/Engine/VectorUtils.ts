import { pathBounds } from '@/fastsvg/pathBounds'
import { VisuElement } from '@/Document'
import { type Point2D } from '@/Document/Struct/Point2D'
import { vectorPathPointsToSVGDCommandArray } from '@/index-ext-brush'
import { Matrix2D } from '@/Math/matrix2d'

export const addPoint2D = (a: Point2D, b: Point2D) => ({
  x: a.x + b.x,
  y: a.y + b.y,
})

export const multiplyPoint2D = (a: Point2D, b: Point2D) => ({
  x: a.x * b.x,
  y: a.y * b.y,
})

export const matrixToCanvasMatrix = (m: Matrix2D) => {
  return [m.a, m.b, m.c, m.d, m.e, m.f] as const
}

export const multiplyMatrix = (a: Matrix2D, b: Matrix2D) => {
  return a.multiply(b)
}

export const composeVisuTransformsToDOMMatrix = (
  a: VisuElement.ElementTransform,
  b: VisuElement.ElementTransform,
) => {
  return multiplyMatrix(visuTransformToMatrix2D(a), visuTransformToMatrix2D(b))
}

export const uncomposeVisuTransformsToDOMMatrix = (
  a: VisuElement.ElementTransform,
  b: VisuElement.ElementTransform,
) => {
  return multiplyMatrix(visuTransformToMatrix2D(a), visuTransformToMatrix2D(b))
}

export const visuTransformToMatrix2D = (trns: VisuElement.ElementTransform) => {
  return new Matrix2D()
    .translate(trns.position.x, trns.position.y)
    .scale([trns.scale.x, trns.scale.y])
    .rotateZ(trns.rotate)
}

export const vectorObjectTransformToMatrix = (
  obj: VisuElement.VectorObjectElement,
) => {
  const bbx = calcVectorBoundingBox(obj)

  return new Matrix2D()
    .translate(bbx.width / 2, bbx.height / 2)
    .translate(obj.transform.position.x, obj.transform.position.y)
    .scale([obj.transform.scale.x, obj.transform.scale.y])
    .rotateZ(obj.transform.rotate)
    .translate(-bbx.width / 2, -bbx.height / 2)
}

export const calcVectorPathBoundingBox = (path: VisuElement.VectorPath) => {
  const bbox = pathBounds(vectorPathPointsToSVGDCommandArray(path.points))
  const left = bbox.left
  const top = bbox.top
  const width = Math.abs(bbox.right - bbox.left)
  const height = Math.abs(bbox.bottom - bbox.top)

  return {
    ...bbox,
    left,
    top,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    width,
    height,
  }
}

export const calcVectorBoundingBox = (obj: VisuElement.VectorObjectElement) => {
  const bbox = pathBounds(vectorPathPointsToSVGDCommandArray(obj.path.points))
  const left = bbox.left + obj.transform.position.x
  const top = bbox.top + obj.transform.position.y
  const width = Math.abs(bbox.right - bbox.left)
  const height = Math.abs(bbox.bottom - bbox.top)

  return {
    ...bbox,
    left,
    top,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    width,
    height,
  }
}

import { pathBounds } from '@/fastsvg/pathBounds'
import { VisuElement } from '@/Document'
import { type Point2D } from '@/Document/Struct/Point2D'
import { vectorPathPointsToSVGDCommandArray } from '@/index-ext-brush'
import { absNormalizePath } from '@/fastsvg/absNormalizePath'
import DOMMatrix from '@thednp/dommatrix'

export const addPoint2D = (a: Point2D, b: Point2D) => ({
  x: a.x + b.x,
  y: a.y + b.y,
})

export const multiplyPoint2D = (a: Point2D, b: Point2D) => ({
  x: a.x * b.x,
  y: a.y * b.y,
})

export const matrixToCanvasMatrix = (m: DOMMatrix) => {
  return [m.a, m.b, m.c, m.d, m.e, m.f] as const
}

export const layerTransformToMatrix = (trns: VisuElement.ElementTransform) => {
  return new DOMMatrix()
    .translate(trns.position.x, trns.position.y)
    .scale(trns.scale.x, trns.scale.y)
    .rotate(0, 0, trns.rotate)
}

export const vectorObjectTransformToMatrix = (
  obj: VisuElement.VectorObjectElement,
) => {
  const bbx = calcVectorBoundingBox(obj)

  return new DOMMatrix()
    .translate(bbx.width / 2, bbx.height / 2)
    .translate(obj.transform.position.x, obj.transform.position.y)
    .scale(obj.transform.scale.x, obj.transform.scale.y)
    .rotate(0, 0, obj.transform.rotate)
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

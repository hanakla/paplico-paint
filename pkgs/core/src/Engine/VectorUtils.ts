import { pathBounds } from '@/fastsvg/pathBounds'
import { VisuElement } from '@/Document'
import { type Point2D } from '@/Document/Structs/Point2D'
import {
  vectorPathPointsToSVGDCommandArray,
  vectorPathPointsToSVGPathString,
} from '@/index-ext-brush'
import { Matrix2D } from '@/Math/matrix2d'
import { LayerMetrics } from './DocumentContext/LayerMetrics'

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

// written by ChatGPT

export function applyMatrixToBBox(
  bbox: LayerMetrics.BBox,
  matrix: Matrix2D,
): LayerMetrics.BBox {
  const transformPoint = (
    x: number,
    y: number,
    matrix: Matrix2D,
  ): { x: number; y: number } => {
    const [a, c, e, b, d, f] = matrix.toArray()
    return {
      x: a * x + c * y + e,
      y: b * x + d * y + f,
    }
  }

  // 各角点の変換
  const topLeft = transformPoint(bbox.left, bbox.top, matrix)
  const topRight = transformPoint(bbox.right, bbox.top, matrix)
  const bottomLeft = transformPoint(bbox.left, bbox.bottom, matrix)
  const bottomRight = transformPoint(bbox.right, bbox.bottom, matrix)

  // 新しいバウンディングボックスの計算
  const newLeft = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)
  const newTop = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)
  const newRight = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)
  const newBottom = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)

  const newWidth = newRight - newLeft
  const newHeight = newBottom - newTop
  const newCenterX = newLeft + newWidth / 2
  const newCenterY = newTop + newHeight / 2

  return {
    left: newLeft,
    top: newTop,
    right: newRight,
    bottom: newBottom,
    width: newWidth,
    height: newHeight,
    centerX: newCenterX,
    centerY: newCenterY,
  }
}
export const composeVisuTransforms = (
  a: VisuElement.ElementTransform,
  b: VisuElement.ElementTransform,
) => {
  return {
    position: addPoint2D(a.position, b.position),
    scale: multiplyPoint2D(a.scale, b.scale),
    rotate: a.rotate + b.rotate,
  }
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
  const bbox = pathBounds(vectorPathPointsToSVGPathString(path.points))

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
  const bbox = pathBounds(vectorPathPointsToSVGPathString(obj.path.points))
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

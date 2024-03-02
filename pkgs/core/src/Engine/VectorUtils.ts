import { pathBounds } from '@/fastsvg/pathBounds'
import { VisuElement } from '@/Document'
import { type Point2D } from '@/Document/Structs/Point2D'
import { vectorPathPointsToSVGPath } from '@/index-ext-brush'
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
  const bboxCenterX = bbox.left + (bbox.right - bbox.left) / 2
  const bboxCenterY = bbox.top + (bbox.bottom - bbox.top) / 2

  // Matrixに変換前の準備を追加
  const preMatrix = new Matrix2D().translate(-bboxCenterX, -bboxCenterY)
  const postMatrix = new Matrix2D().translate(bboxCenterX, bboxCenterY)

  // 変換を適用
  const appliedMatrix = preMatrix.multiply(matrix).multiply(postMatrix)

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
  const topLeft = transformPoint(bbox.left, bbox.top, appliedMatrix)
  const topRight = transformPoint(bbox.right, bbox.top, appliedMatrix)
  const bottomLeft = transformPoint(bbox.left, bbox.bottom, appliedMatrix)
  const bottomRight = transformPoint(bbox.right, bbox.bottom, appliedMatrix)

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
): VisuElement.ElementTransform => {
  return {
    translate: addPoint2D(a.translate, b.translate),
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
    .translate(trns.translate.x, trns.translate.y)
    .scale([trns.scale.x, trns.scale.y])
    .rotateZ(trns.rotate)
}

export const vectorObjectTransformToMatrix = (
  obj: VisuElement.VectorObjectElement,
) => {
  const bbx = calcVectorBoundingBox(obj)

  return new Matrix2D()
    .translate(bbx.width / 2, bbx.height / 2)
    .translate(obj.transform.translate.x, obj.transform.translate.y)
    .scale([obj.transform.scale.x, obj.transform.scale.y])
    .rotateZ(obj.transform.rotate)
    .translate(-bbx.width / 2, -bbx.height / 2)
}

export const calcVectorPathBoundingBox = (path: VisuElement.VectorPath) => {
  const bbox = pathBounds(vectorPathPointsToSVGPath(path.points))

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
  const bbox = pathBounds(vectorPathPointsToSVGPath(obj.path.points))
  const left = bbox.left + obj.transform.translate.x
  const top = bbox.top + obj.transform.translate.y
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

export function applyTransformToVectorPath(
  path: VisuElement.VectorPath,
  transform: VisuElement.ElementTransform,
): VisuElement.VectorPath {
  const bounds = pathBounds(vectorPathPointsToSVGPath(path.points))

  const centerX = bounds.left + (bounds.right - bounds.left) / 2
  const centerY = bounds.top + (bounds.bottom - bounds.top) / 2

  const newPoints = path.points.map((point) => {
    if (point.isClose) {
      return point
    }

    // Translate
    let newX = point.x + transform.translate.x
    let newY = point.y + transform.translate.y

    // Scale
    newX *= transform.scale.x
    newY *= transform.scale.y

    // 回転前の準備：点を重心に向けて移動
    newX -= centerX
    newY -= centerY

    // Rotate
    const angle = (transform.rotate * Math.PI) / 180 // Convert to radians
    const rotatedX = newX * Math.cos(angle) - newY * Math.sin(angle)
    const rotatedY = newX * Math.sin(angle) + newY * Math.cos(angle)

    // 回転後の調整：元の位置に戻す
    newX = rotatedX + centerX
    newY = rotatedY + centerY

    // Return the transformed point
    return {
      ...point,
      x: newX,
      y: newY,
      ...(point.begin
        ? {
            begin: {
              x:
                (point.begin.x * transform.scale.x +
                  transform.translate.x -
                  centerX) *
                  Math.cos(angle) -
                (point.begin.y * transform.scale.y +
                  transform.translate.y -
                  centerY) *
                  Math.sin(angle) +
                centerX,
              y:
                (point.begin.x * transform.scale.x +
                  transform.translate.x -
                  centerX) *
                  Math.sin(angle) +
                (point.begin.y * transform.scale.y +
                  transform.translate.y -
                  centerY) *
                  Math.cos(angle) +
                centerY,
            },
          }
        : {}),
      ...(point.end
        ? {
            x:
              (point.end.x * transform.scale.x +
                transform.translate.x -
                centerX) *
                Math.cos(angle) -
              (point.end.y * transform.scale.y +
                transform.translate.y -
                centerY) *
                Math.sin(angle) +
              centerX,
            y:
              (point.end.x * transform.scale.x +
                transform.translate.x -
                centerX) *
                Math.sin(angle) +
              (point.end.y * transform.scale.y +
                transform.translate.y -
                centerY) *
                Math.cos(angle) +
              centerY,
          }
        : {}),
    }
  })

  return {
    ...path,
    points: newPoints,
  }
}

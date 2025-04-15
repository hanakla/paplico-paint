import { LayerMetrics } from './DocumentContext/LayerMetrics'
import { pathBounds } from '@/fastsvg/pathBounds'
import { VisuElement } from '@/Document'
import { type Point2D } from '@/Document/Structs/Point2D'
import { vectorPathPointsToSVGPath } from '@/index-ext-brush'
import { Matrix2D } from '@/Math/matrix2d'
import { Paplico } from '@/Engine/Paplico'

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

export function applyMatrixToBBox(
  bbox: LayerMetrics.BBox,
  matrix: Matrix2D,
): LayerMetrics.BBox {
  const transformPoint = (
    x: number,
    y: number,
    matrix: Matrix2D,
  ): { x: number; y: number } => {
    const [a, b, c, d, e, f] = matrix.toArray()
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
  ...transforms: VisuElement.ElementTransform[]
): VisuElement.ElementTransform => {
  return transforms.reduce(
    (acc, trns) => ({
      translate: addPoint2D(acc.translate, trns.translate),
      scale: multiplyPoint2D(acc.scale, trns.scale),
      rotate: acc.rotate + trns.rotate,
    }),
    {
      translate: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotate: 0,
    },
  )
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

export const mapPathInViewport = (
  path: VisuElement.VectorPath,
  viewport: Paplico.Viewport,
): VisuElement.VectorPath => {
  return {
    ...path,
    points: path.points.map((point) => {
      return {
        ...point,
        x: point.x + viewport.left,
        y: point.y + viewport.top,
        begin: point.begin
          ? {
              x: point.begin.x + viewport.left,
              y: point.begin.y + viewport.top,
            }
          : undefined,
        end: point.end
          ? {
              x: point.end.x + viewport.left,
              y: point.end.y + viewport.top,
            }
          : undefined,
      }
    }),
  }
}

export const viewportToTransform = (viewport: Viewport, neg?: boolean) => {
  return {
    translate: {
      x: neg ? viewport.left : -viewport.left,
      y: neg ? viewport.top : -viewport.top,
    },
    scale: { x: 1, y: 1 },
    rotate: 0,
  }
}

export function applyTransformTranslateToVectorPath(
  path: VisuElement.VectorPath,
  transform: VisuElement.ElementTransform,
): VisuElement.VectorPath {
  const newPoints = path.points.map((point) => {
    if (point.isClose) {
      return point
    }

    const translatedPoint = {
      ...point,
      x: point.x + transform.translate.x,
      y: point.y + transform.translate.y,
      ...(point.begin
        ? {
            begin: {
              x: point.begin.x + transform.translate.x,
              y: point.begin.y + transform.translate.y,
            },
          }
        : {}),
      ...(point.end
        ? {
            end: {
              x: point.end.x + transform.translate.x,
              y: point.end.y + transform.translate.y,
            },
          }
        : {}),
    }

    return translatedPoint
  })

  return {
    ...path,
    points: newPoints,
  }
}

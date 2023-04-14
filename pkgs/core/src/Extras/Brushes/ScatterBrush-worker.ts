import { pointsToSVGCommandArray } from '@/Engine/VectorUtils'
import { type BrushLayoutData } from '@/index'
import { getRadianFromTangent } from '@/StrokeHelper'
import { interpolateMapObject, lerp, Matrix4 } from '@/Math'
import { indexedPointAtLength } from '@/fastsvg/CachedPointAtLength'
import { type VectorPath } from '@/Document/LayerEntity/VectorPath'
import { degToRad } from '@/utils/math'

export type Payload =
  | { type: 'warming' }
  | { type: 'aborted'; id: string }
  | {
      id: string
      type: 'getPoints'
      path: VectorPath
      destSize: { width: number; height: number }
      brushSize: number
      scatterRange: number
      scatterScale: number
    }

export type GetPointWorkerResponse = {
  id: string
  type: 'getPoints'
  matrices: Array<number[] | Float32Array>
  lengths: number[]
  totalLength: number
  bbox: { left: number; top: number; right: number; bottom: number } | null
}

export type WorkerResponse = { type: 'warming' } | GetPointWorkerResponse

const abortedTasks = new Set<string>()
const RAD90DEG = degToRad(90)

self.onmessage = async ({ data }: MessageEvent<Payload>) => {
  switch (data.type) {
    case 'warming': {
      self.postMessage({ type: 'warming' })
      break
    }

    case 'aborted': {
      abortedTasks.add(data.id)
      break
    }

    case 'getPoints': {
      const { id, path, destSize, brushSize, scatterRange, scatterScale } = data
      const { points } = path

      const lengths: number[] = []
      const matrices: (number[] | Float32Array)[] = []
      const bbox: BrushLayoutData['bbox'] = {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      }

      // const scattered = scatterPlot(path, {
      //   counts: path.points.length * 300,
      //   scatterRange: 2,
      //   scatterScale: 1,
      // })

      const pal = indexedPointAtLength(
        pointsToSVGCommandArray(path.points, path.closed)
      )

      // const seqPal = pal.getSequencialReader()
      const totalLen = pal.totalLength

      if (totalLen === 0) {
        self.postMessage({ id, type: 'getPoints', points: null, bbox: null })
        return
      }

      const step = 1000 / totalLen

      for (let len = 0; len <= totalLen; len += step) {
        if (abortedTasks.has(id)) {
          abortedTasks.delete(id)
          return
        }

        const t = len / totalLen
        // const [x, y] = [interX(t), interY(t)]
        const [x, y] = pal.at(t * totalLen)
        const next = pal.at(t + 0.01, { seek: false })

        const rad =
          getRadianFromTangent({ x, y }, { x: next[0], y: next[1] }) + RAD90DEG

        const ypos = y / destSize.height

        const matt4 = new Matrix4()
          .translate(
            x +
              lerp(-scatterRange, scatterRange, Math.cos(rad)) -
              destSize.width / 2,
            (1 - (ypos + lerp(-scatterRange, scatterRange, Math.sin(rad)))) *
              destSize.height -
              destSize.height / 2,
            0
          )
          .scale([brushSize, brushSize, 1])
          .rotateZ(rad)

        // _mat4.fromArray(matt4.toArray())
        matrices.push(matt4.toArray())
        lengths.push(len)

        bbox.left = Math.min(bbox.left, x)
        bbox.top = Math.min(bbox.top, y)
        bbox.right = Math.max(bbox.right, x)
        bbox.bottom = Math.max(bbox.bottom, y)
      }

      if (abortedTasks.has(id)) {
        abortedTasks.delete(id)
        return
      }

      self.postMessage({
        type: 'getPoints',
        id,
        bbox,
        lengths,
        totalLength: totalLen,
        matrices,
      } satisfies GetPointWorkerResponse)
    }

    default:
      break
  }
}

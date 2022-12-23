import { pointsToSVGCommandArray } from '@/Engine/VectorUtils'
import { type BrushLayoutData } from '@/index'
import { getRadianFromTangent } from '@/StrokeHelper'
import { interpolateMapObject, Matrix4 } from '@/Math'
import { indexedPointAtLength } from '@/fastsvg/CachedPointAtLength'
import { type VectorPath } from '@/Document/LayerEntity/VectorPath'

export type Payload =
  | { type: 'warming' }
  | { type: 'aborted'; id: string }
  | {
      id: string
      type: 'getPoints'
      path: VectorPath
      destSize: { width: number; height: number }
      scatterRange: number
      scatterScale: number
    }

export type GetPointWorkerResponse = {
  id: string
  type: 'getPoints'
  matrices: Array<number[] | Float32Array>
  bbox: { left: number; top: number; right: number; bottom: number } | null
}

export type WorkerResponse = { type: 'warming' } | GetPointWorkerResponse

const abortedTasks = new Set<string>()

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
      const { id, path, destSize, scatterRange, scatterScale } = data
      const { points } = path

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
      const counts = Math.round(totalLen / step)

      const interX = interpolateMapObject(points, (idx, arr) => arr[idx].x)
      const interY = interpolateMapObject(points, (idx, arr) => arr[idx].y)

      let i = 0
      for (let len = 0; len <= totalLen; len += step) {
        if (abortedTasks.has(id)) {
          abortedTasks.delete(id)
          return
        }

        i++
        i % 1000 === 0 && (await new Promise((r) => setTimeout(r, 0)))

        const t = len / totalLen
        const [x, y] = [interX(t), interY(t)]

        const rad = getRadianFromTangent(
          { x, y },
          { x: interX(t + 0.01), y: interY(t + 0.01) }
        )

        const ypos = y / destSize.height

        const matt4 = new Matrix4()
          .translate(
            x - destSize.width / 2,
            (1 - ypos) * destSize.height - destSize.height / 2,
            0
          )
          .rotateZ(rad)

        // _mat4.fromArray(matt4.toArray())
        matrices.push(matt4.toArray())

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
        matrices,
      } satisfies GetPointWorkerResponse)
    }

    default:
      break
  }
}

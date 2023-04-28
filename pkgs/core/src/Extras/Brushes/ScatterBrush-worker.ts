import { pointsToSVGCommandArray } from '@/Engine/VectorUtils'
import { type BrushLayoutData } from '@/index'
import { getRadianFromTangent } from '@/StrokeHelper'
import { Matrix4 } from '@/Math'
import { indexedPointAtLength } from '@/fastsvg/IndexedPointAtLength'
import { type VectorPath } from '@/Document/LayerEntity/VectorPath'

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
      inOutInfluence: number
      inOutLength: number
    }

export type GetPointWorkerResponse = {
  id: string
  type: 'getPoints'
  matrices: Array<number[] | Float32Array>
  lengths: number[]
  totalLength: number
  bbox: { left: number; top: number; right: number; bottom: number } | null
}

export type WorkerResponse =
  | { type: 'warming' }
  | { type: 'aborted'; id: string }
  | GetPointWorkerResponse

const abortedTasks = new Set<string>()

const handleMessage = (
  handler: (event: MessageEvent<Payload>) => Promise<WorkerResponse | undefined>
) => {
  return async (event: MessageEvent<Payload>) => {
    const result = await handler(event)
    if (result != null) {
      self.postMessage(result)
    }
  }
}

self.onmessage = handleMessage(async ({ data }) => {
  switch (data.type) {
    case 'warming': {
      return { type: 'warming' }
    }

    case 'aborted': {
      abortedTasks.add(data.id)
      break
    }

    case 'getPoints': {
      const {
        id,
        path,
        destSize,
        brushSize,
        scatterRange,
        scatterScale,
        inOutInfluence,
        inOutLength,
      } = data

      const positions: number[] = []
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
      ).getSequencialReader()

      // const seqPal = pal.getSequencialReader()
      const totalLen = pal.totalLength

      if (totalLen === 0) {
        return { id, type: 'getPoints', points: null, bbox: null }
      }

      const step = 500 / totalLen

      for (let len = 0; len <= totalLen; len += step) {
        // wait for tick (for receiving abort message from main thread)
        await Promise.resolve()

        if (abortedTasks.has(id)) {
          abortedTasks.delete(id)
          return { id, type: 'aborted' }
        }

        const [x, y] = pal.at(len)
        const next = pal.at(len + 0.01, { seek: false })

        const rad = getRadianFromTangent({ x, y }, { x: next[0], y: next[1] })

        const ypos = y / destSize.height

        // if len in inOutLength from start or end, scale by inOutInfluence
        // prettier-ignore
        const inoutScale =
          len <= inOutLength ? inOutInfluence * len / inOutLength
          : len >= totalLen - inOutLength ? inOutInfluence * (totalLen - len) / inOutLength
          : 1

        const matt4 = new Matrix4()
          .translate(
            x - destSize.width / 2,
            (1 - ypos) * destSize.height - destSize.height / 2,
            0
          )
          .scale([brushSize * inoutScale, brushSize * inoutScale, 1])
          .rotateZ(rad)

        // _mat4.fromArray(matt4.toArray())
        matrices.push(matt4.toArray())
        lengths.push(len)
        positions.push([x, y])

        bbox.left = Math.min(bbox.left, x)
        bbox.top = Math.min(bbox.top, y)
        bbox.right = Math.max(bbox.right, x)
        bbox.bottom = Math.max(bbox.bottom, y)
      }

      if (abortedTasks.has(id)) {
        abortedTasks.delete(id)
        return { id, type: 'aborted' }
      }

      return {
        type: 'getPoints',
        id,
        bbox,
        lengths,
        totalLength: totalLen,
        matrices,
      }
    }

    default:
      break
  }
})

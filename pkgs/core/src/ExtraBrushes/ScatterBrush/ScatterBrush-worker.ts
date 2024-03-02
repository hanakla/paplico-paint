import {
  BrushLayoutData,
  createStreamScatter,
  getRadianFromTangent,
} from '@/index-ext-brush'
import { Matrix4 } from '@/Math'
import { indexedPointAtLength } from '@/fastsvg/IndexedPointAtLength'
import { mapLinear } from '@/Math/interpolation'
import { vectorPathPointsToSVGCommandArray } from '@/SVGPathManipul'
import { VisuElement } from '@/Document'

export type Payload =
  | { type: 'warming' }
  | { type: 'aborted'; id: string }
  | {
      id: string
      type: 'getPoints'
      path: VisuElement.VectorPath
      destSize: { width: number; height: number }
      pixelRatio: number
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
  _debug: any
}

export type WorkerResponse =
  | { type: 'warming' }
  | { type: 'aborted'; id: string }
  | GetPointWorkerResponse

const abortedTasks = new Set<string>()
const queue: Payload[] = []
const queueResult = new Map<string, WorkerResponse>()

const handleMessage = (
  handler: (
    event: MessageEvent<Payload>,
  ) => Promise<WorkerResponse | undefined>,
) => {
  return async (event: MessageEvent<Payload>) => {
    const result = await handler(event)
    if (result != null) {
      self.postMessage(result)
    }
  }
}

if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  self.onmessage = handleMessage(async ({ data }) => {
    switch (data.type) {
      case 'warming': {
        return { type: 'warming' }
      }

      case 'aborted': {
        // console.log('receive aboterd on worker')
        abortedTasks.add(data.id)
        break
      }

      case 'getPoints': {
        queue.push(data)

        return await new Promise((r) => {
          setTimeout(function waitResult() {
            const result = queueResult.get(data.id)

            if (result != null) {
              queueResult.delete(data.id)
              return r(result)
            }

            setTimeout(waitResult)
          })
        })
      }

      default:
        break
    }
  })

  setTimeout(async function processQueue() {
    const task = queue.shift()

    if (task == null || task.type !== 'getPoints') {
      setTimeout(processQueue)
      return
    }

    try {
      const res = await processInput(task)
      queueResult.set(task.id, res)
    } finally {
      setTimeout(processQueue)
    }
  })
}

export async function processInput(data: Payload): Promise<WorkerResponse> {
  if (data.type !== 'getPoints') {
    throw new Error(`Invalid payload type: ${data.type}}`)
  }

  if (abortedTasks.has(data.id)) return { type: 'aborted', id: data.id }

  const {
    id,
    path,
    destSize,
    pixelRatio,
    brushSize,
    scatterRange,
    scatterScale,
    inOutInfluence,
    inOutLength,
  } = data

  const originalWidth = destSize.width
  const originalHeight = destSize.height

  const destWidth = destSize.width * pixelRatio
  const destHeight = destSize.height * pixelRatio

  const _debug_positions: [number, number][] = []
  const lengths: number[] = []
  const matrices: (number[] | Float32Array)[] = []
  const bbox: BrushLayoutData['bbox'] = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  }

  const pal = indexedPointAtLength(
    vectorPathPointsToSVGCommandArray(path.points),
  )

  const totalLen = pal.totalLength

  if (totalLen === 0) {
    return {
      id,
      type: 'getPoints',
      matrices: [],
      lengths: [],
      bbox: null,
      totalLength: 0,
      _debug: {},
    }
  }

  const step = 1

  const requestAts: number[] = []
  for (let len = 0; len <= totalLen; len += step) {
    requestAts.push(len)
    requestAts.push(len + 0.01)
  }
  requestAts.push(totalLen)

  const points = pal.atBatch(requestAts)
  const scatter = createStreamScatter(path, pal, {
    counts: path.points.length * 300,
    scatterRange,
    scatterScale,
  })

  for (let idx = 0, l = points.length; idx < l; idx += 2) {
    // wait for tick (for receiving abort message from main thread)
    await new Promise<void>((r) => queueMicrotask(r))

    if (abortedTasks.has(id)) {
      // console.info('aboterd on worker')
      abortedTasks.delete(id)
      return { id, type: 'aborted' }
    }

    const len = points[idx].length
    const frac = len / totalLen
    let [x, y] = points[idx].pos
    _debug_positions.push([x, y])
    const next = points[idx + 1]?.pos ?? points[idx]?.pos //pal.at(len + 0.01, { seek: false })

    const rad = getRadianFromTangent(x, y, next[0], next[1])
    const scatPoint = scatter.scatterPoint(x, y, frac)

    // if len in inOutLength from start or end, scale by inOutInfluence
    // prettier-ignore
    // const inoutScale = inOutLength === 0 ? 1
    //   : len <= inOutLength ? inOutInfluence * len / inOutLength
    //   : len >= totalLen - inOutLength ? inOutInfluence * (totalLen - len) / inOutLength
    //   : 1;
    const inoutScale = inOutLength === 0 ? 1
      : len <= inOutLength ? inOutInfluence * len / inOutLength
      : len >= totalLen - inOutLength ? inOutInfluence * (totalLen - len) / inOutLength
      : 1;

    const matt4 = new Matrix4()
      .translate(
        // x,
        // y,
        mapLinear(
          scatPoint.x,
          [0, originalWidth],
          [-destWidth / 2, destWidth / 2],
        ),
        mapLinear(
          scatPoint.y,
          [0, originalHeight],
          [destHeight / 2, -destHeight / 2],
        ),
        0,
      )
      .scale([
        brushSize * inoutScale * scatPoint.scale * pixelRatio,
        brushSize * inoutScale * scatPoint.scale * pixelRatio,
        1,
      ])
      .rotateZ(rad + scatPoint.rotate)

    matrices.push(matt4.toArray())
    lengths.push(len)

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
    _debug: {
      // requestAts,
      // path,
      // positions: _debug_positions,
    },
  }
}

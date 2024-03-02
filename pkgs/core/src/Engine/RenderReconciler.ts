import { LogChannel } from '@/Debugging/LogChannel'

export const RenderQueuePriority = {
  finish: 10,
  preview: 5,
  idleQue: 1,
} as const
export type RenderQueuePriority =
  (typeof RenderQueuePriority)[keyof typeof RenderQueuePriority]

type QueueEntry = {
  priority: RenderQueuePriority
  render: (signal: AbortSignal) => Promise<void>
  abortController: AbortController
  completed: boolean
  entryAt: number
}

const MS_PER_FRAME = 1000 / 60
const GRACE_FRAMES = 5

export class RenderReconciler {
  public queue: QueueEntry[] = []

  protected currentTask: QueueEntry | undefined | null = null

  public constructor() {}

  public enqueue(
    execute: (signal: AbortSignal) => Promise<void>,
    priority: RenderQueuePriority,
  ) {
    try {
      this.queue.push({
        priority,
        completed: false,
        abortController: new AbortController(),
        render: execute,
        entryAt: Date.now(),
      })

      if (this.currentTask == null) {
        this.onTaskFinished()
      }
    } catch (e) {
      this.currentTask = null
      throw e
    }
  }

  protected onTaskFinished() {
    const completedTask = this.currentTask

    const uncompletedQueues = this.queue.filter(
      (q) => q !== completedTask && q.completed === false,
    )

    const sortedUncompletes = uncompletedQueues.sort(
      (aq, bq) => bq.entryAt - aq.entryAt,
    )

    const latestPreviewEntries = sortedUncompletes.find(
      (q) => q.priority === RenderQueuePriority.preview,
    )
    const latestFinishEntry = sortedUncompletes.find(
      (q) => q.priority === RenderQueuePriority.finish,
    )
    const latestIdleEntry = sortedUncompletes.find(
      (q) => q.priority === RenderQueuePriority.idleQue,
    )

    const nextEntry =
      latestFinishEntry || latestPreviewEntries || latestIdleEntry

    let nextQueue = [
      latestFinishEntry,
      // When finish entry exists, drop previous preview queue
      latestFinishEntry ? null : latestPreviewEntries,
      latestIdleEntry,
    ]
      .filter((q): q is NonNullable<typeof q> => q != null)
      .filter((q) => q !== nextEntry)
      .sort((aq, bq) => bq.entryAt - aq.entryAt)

    if (latestFinishEntry) {
      nextQueue = nextQueue.filter((q) => {
        return q.entryAt > latestFinishEntry.entryAt
      })

      this.currentTask?.abortController.abort()
    }

    const droppedQueues = this.queue.filter(
      (q) => !nextQueue.includes(q) && q !== nextEntry,
    )

    if (droppedQueues.length > 0) {
      LogChannel.l.renderQueue.info(
        'Render queues pruned: ',

        `Drop ${droppedQueues.length} queues (${
          droppedQueues.filter((q) => q.priority === RenderQueuePriority.finish)
            .length
        } finish, ${
          droppedQueues.filter(
            (q) => q.priority === RenderQueuePriority.preview,
          ).length
        } preview, ${
          droppedQueues.filter(
            (q) => q.priority === RenderQueuePriority.idleQue,
          ).length
        } idleQue)`,

        this.queue,
      )
    }

    droppedQueues.forEach((q) => q.abortController.abort())

    this.queue = nextQueue
    this.currentTask = nextEntry

    setTimeout(() => {
      if (nextEntry?.priority === RenderQueuePriority.preview) {
        nextEntry?.abortController.abort()
      }
    }, MS_PER_FRAME * GRACE_FRAMES)

    nextEntry?.render(nextEntry.abortController.signal).finally(() => {
      nextEntry.completed = true

      this.onTaskFinished()
    })

    this.currentTask = nextEntry || null
  }
}

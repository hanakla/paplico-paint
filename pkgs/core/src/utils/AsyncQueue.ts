export class RenderQueue<T extends string> {
  private queue: Map<string, (() => Promise<void>)[]> = new Map()
  private current: Promise<void> | null = null

  public queueLength(line: T) {
    return this.queue.get(line)?.length ?? 0
  }

  public push(
    line: T,
    fn: () => Promise<void>,
    { maxQueue = 100 }: { maxQueue?: number } = {},
  ) {
    const queueList = this.queue.get(line) ?? []
    this.queue.set(line, queueList)

    queueList.push(fn)

    // const last = this.queue.at(-1)
    const previous = this.current ?? Promise.resolve()

    previous.finally(() => {
      // expired
      if (!queueList.includes(fn)) return

      this.current = fn().finally(() => {
        this.current = null

        // expiration old queues
        queueList.splice(0, Math.max(0, queueList.length - maxQueue))
        queueList.splice(queueList.indexOf(fn), 1)
      })
    })
  }
}

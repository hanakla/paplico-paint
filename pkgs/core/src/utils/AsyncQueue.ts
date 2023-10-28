export class AsyncQueue<T extends string> {
  private queue: Map<string, (() => Promise<void>)[]> = new Map()
  private current: Promise<void> | null = null

  public queueLength(line: T) {
    return this.queue.get(line)?.length ?? 0
  }

  public push(line: T, fn: () => Promise<void>) {
    const queueList = this.queue.get(line) ?? []
    this.queue.set(line, queueList)

    queueList.push(fn)

    // const last = this.queue.at(-1)
    const previous = this.current ?? Promise.resolve()

    previous.finally(() => {
      this.current = fn().finally(() => {
        this.current = null
        this.queue.set(
          line,
          queueList.filter((f) => f !== fn),
        )
      })
    })
  }
}

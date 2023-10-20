export class AsyncQueue {
  private queue: Map<string, (() => Promise<void>)[]> = new Map()
  private current: Promise<void> | null = null

  public get length() {
    return this.queue.size
  }

  public push(line: string, fn: () => Promise<void>) {
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

type LogKind =
  | 'log'
  | 'error'
  | 'warn'
  | 'info'
  | 'timeEnd'
  | 'group'
  | 'groupEnd'

export class RenderCycleLogger {
  public static enabled = true

  public static current = new RenderCycleLogger()

  public static createNext() {
    this.current = new RenderCycleLogger()
    return this.current
  }

  public logs: [LogKind, ...any[]][] = []
  public currentGroup: {
    label: any[]
    logs: [LogKind, ...any[]][]
  } | null = null

  private _times = new Map<string, number>()

  public printLogs(label?: string) {
    if (!RenderCycleLogger.enabled) return

    console.group(`Render cycle logs: ${label ?? ''}`)

    for (const [kind, ...message] of this.logs) {
      console[kind](...message)
    }
    console.groupEnd()
  }

  private get currentStack() {
    return this.currentGroup?.logs ?? this.logs
  }

  public log(...message: any[]) {
    this.currentStack.push(['log', ...message])
  }

  public error(...message: any[]) {
    this.currentStack.push(['error', ...message])
  }

  public warn(...message: any[]) {
    this.currentStack.push(['warn', ...message])
  }

  public info(...message: any[]) {
    this.currentStack.push(['info', ...message])
  }

  public time(label: string) {
    this._times.set(label, performance.now())
  }

  public timeEnd(label: string) {
    const start = this._times.get(label)

    if (start) {
      this._times.delete(label)

      this.currentStack.push([
        'log',
        `Time: ${label}`,
        `${performance.now() - start}ms`
      ])
    }
  }

  public group(...label: any[]) {
    this.currentGroup = { label, logs: [] }
  }

  public groupEnd() {
    if (!this.currentGroup) return

    this.logs.push(['group', ...this.currentGroup.label])
    this.logs.push(...this.currentGroup.logs)
    this.logs.push(['groupEnd'])
  }
}

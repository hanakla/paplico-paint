type PerfStats = {
  calls: CallEntry[]
}

type CallEntry = {
  perfs: { [label: string]: LabelEntry[] }
}

type LabelEntry = { time: number; details: any[] }
;({
  calls: [
    {
      perfs: {
        test: [
          { lastStartTimes: { test: 0 }, perfs: [{ time: 0, details: [] }] },
          { lastStartTimes: { test: 0 }, perfs: [{ time: 0, details: [] }] },
        ],
      },
    },
  ],
})

const stats = new WeakMap<Function, PerfStats>()

export class FuncStats {
  public static start(fn: Function) {
    const stat: PerfStats = stats.get(fn) ?? { calls: [] }
    stats.set(fn, stat)

    const entry: CallEntry = { perfs: {} }

    let startTimes: {
      [label: string]: { lastStartTime: number } | null
    } = {}

    const handlers = {
      finish: () => {
        stat.calls.push(entry)
      },
      time: (label: string) => {
        if (startTimes[label] != null) return () => {}
        startTimes[label] = { lastStartTime: performance.now() }

        return () => {
          handlers.timeEnd(label)
        }
      },
      timeEnd: (label: string, ...details: any[]) => {
        if (startTimes[label] == null) return

        const time = performance.now() - startTimes[label]!.lastStartTime
        entry.perfs[label] ??= []
        entry.perfs[label].push({ time, details })

        delete startTimes[label]
      },
    }

    return handlers
  }

  public static clearStats(fn: Function) {
    stats.delete(fn)
  }

  public static getStats(fn: Function) {
    const callLog = stats.get(fn)
    if (!callLog) return null

    const result = {
      average: callLog.calls.reduce((acc, entry) => {
        const callPerLabel: { [label: string]: number } = {}

        for (const label of Object.keys(entry.perfs)) {
          callPerLabel[label] ??= 0

          const labelSum = entry.perfs[label].reduce((sum, perf) => {
            callPerLabel[label] += 1
            return sum + perf.time
          }, 0)

          acc[label] = {
            time:
              (acc[label]?.time ?? 0) + labelSum / entry.perfs[label].length,
            calls: (acc[label]?.calls ?? 0) + callPerLabel[label],
          }
        }

        return acc
      }, {} as { [label: string]: { time: number; calls: number } }),
      sum: callLog.calls.reduce((acc, entry) => {
        for (const label of Object.keys(entry.perfs)) {
          acc[label] = {
            time:
              (acc[label]?.time ?? 0) +
              entry.perfs[label].reduce((sum, perf) => sum + perf.time, 0),
            calls: (acc[label]?.calls ?? 0) + entry.perfs[label].length,
          }
        }

        return acc
      }, {} as { [label: string]: { time: number; calls: number } }),
    }

    return {
      ...result,
      log: () => {
        console.log('Perf:\n  Averages:')
        Object.keys(result.average).forEach((label) =>
          console.log(
            `    ${label}: ${result.average[label].time}ms (logs: ${result.average[label].calls} times)`
          )
        )

        console.log('  Sums:')
        Object.keys(result.sum).forEach((label) =>
          console.log(
            `    ${label}: ${result.sum[label].time}ms (logs: ${result.sum[label].calls} times)`
          )
        )
      },
    }
  }
}

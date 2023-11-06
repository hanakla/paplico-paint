import { logImage } from './utils/DebugHelper'

const channels = [
  'paplico',
  'pipeline',
  'pipelineSchedule',
  'vectorRenderer',
  'pplcStroking',
] as const
type Channels = (typeof channels)[number]

const listens = new Set<(typeof channels)[number]>([
  // 'pipeline',
  // 'vectorRenderer',
  // 'pipelineSchedule',
  // 'pplcStroking',
])
const colors: { [K in Channels]: string } = {
  paplico: '#69d813',
  pipeline: '#eeeeee',
  pipelineSchedule: '#f2ede6',
  vectorRenderer: '#ff9800',
  pplcStroking: '#c1da1f',
}

type LogType = 'log' | 'info' | 'warn' | 'error' | 'logImage'

// const logs = new Map<Channels, Array<[type: LogType, ...args: any]>>()

export const LogChannel = {
  tgl: Object.defineProperties(
    Object.create(null),
    Object.fromEntries(
      channels.map((c): [string, PropertyDescriptor] => [
        c,
        {
          enumerable: true,
          get: () => {
            const has = listens.has(c)
            has ? listens.delete(c) : listens.add(c)
            console.info(`${c} log turned ${has ? 'off' : 'on'}`)

            return (enabled: boolean) => {
              console.info(`${c} log turned ${!enabled ? 'off' : 'on'}`)
              enabled ? listens.add(c) : listens.delete(c)
            }
          },
        },
      ]),
    ),
  ) as {
    [K in Channels]: (enabled: boolean) => void
  },

  l: Object.defineProperties(
    Object.create(null),
    Object.fromEntries(
      channels.map((c): [string, PropertyDescriptor] => [
        c,
        {
          enumerable: true,
          value: (() => {
            const addLog = (type: LogType, ...args: any[]) => {
              if (process.env.NODE_ENV === 'production') return
              if (!listens.has(c)) return

              const logArgs = [
                `%c[🤖 #${c}]%c`,
                `color: #888; font-weight: bold; background: ${colors[c]}; padding: 2px 4px; border-radius: 2px;`,
                '',
                ...args,
              ]

              // if (!logs.has(c)) logs.set(c, [])
              // logs.get(c)!.push([type, ...logArgs])

              if (listens.has(c)) {
                if (type === 'logImage') {
                  return logImage(args[0], ...args.slice(1))
                }

                console[type](...logArgs)
              }
            }

            const log = (...args: any[]) => addLog('log', ...args)
            log.info = (...args: any[]) => addLog('info', ...args)
            log.warn = (...args: any[]) => addLog('warn', ...args)
            log.error = (...args: any[]) => addLog('error', ...args)
            log.logImage = (...args: any[]) => addLog('logImage', ...args)

            return log
          })(),
        },
      ]),
    ),
  ) as {
    [K in Channels]: {
      (...args: any[]): void
      info(...args: any[]): void
      warn(...args: any[]): void
      error(...args: any[]): void
      logImage(
        image:
          | ImageBitmap
          | ImageData
          | HTMLCanvasElement
          | CanvasRenderingContext2D
          | OffscreenCanvas,
        ...args: any
      ): Promise<void>
    }
  },
}

if (typeof window !== 'undefined') {
  ;(window as any)._logc = LogChannel
}

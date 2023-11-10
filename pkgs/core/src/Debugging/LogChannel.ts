import { logImage } from '../utils/DebugHelper'

const channels = [
  'paplico',
  'pipeline',
  'pipelineSchedule',
  'vectorRenderer',
  'pplcStroking',
  'layerMetrics',
  'renderQueue',
] as const
type Channels = (typeof channels)[number]

///////////////////////////////
///////////////////////////////

const listens = new Set<(typeof channels)[number]>([
  'pipeline',
  // 'vectorRenderer',
  // 'pipelineSchedule',
  // 'pplcStroking',
])

///////////////////////////////
///////////////////////////////

const colors: { [K in Channels]: [string, string] } = {
  // backgroud, text
  paplico: ['#69d813', '#888888'],
  pipeline: ['#eeeeee', '#888888'],
  pipelineSchedule: ['#f2ede6', '#888888'],
  vectorRenderer: ['#ff9800', '#888888'],
  pplcStroking: ['#d4ed37', '#888888'],
  layerMetrics: ['#3087e4', '#f3f3f3'],
  renderQueue: ['#df4a3a', '#f3f3f3'],
}

type LogType = 'log' | 'info' | 'warn' | 'error' | 'logImage'

const allLogs = new Map<Channels, Array<[type: LogType, ...args: any]>>()

function loadLocalSetting() {
  if (typeof localStorage === 'undefined') return
  if (loaded) return

  const str = localStorage.getItem('__pplc_dbg_logc') ?? '{}'
  const logcSetting = JSON.parse(str)

  for (const c of logcSetting?.listens ?? []) {
    if (logcSetting[c] != null) listens.add(c)
  }

  updateLocalSettings({ listens: [...listens] })
}

let loaded = false
function updateLocalSettings(obj: { listens: string[] }) {
  if (typeof localStorage === 'undefined') return

  localStorage.setItem('__pplc_dbg_logc', JSON.stringify(obj))
  loaded = true
}

let globalOn = true

export const LogChannel = {
  get off() {
    globalOn = false
    console.info('Log turned off')
    return
  },
  get on() {
    globalOn = true
    console.info('Log turned on')
    return
  },

  sw: Object.defineProperties(
    Object.create(null),
    Object.fromEntries(
      channels.map((c): [string, PropertyDescriptor] => [
        c,
        {
          enumerable: true,
          get: () => {
            const listened = listens.has(c)
            listened ? listens.delete(c) : listens.add(c)
            updateLocalSettings({ listens: [...listens] })

            console.info(`${c} log turned ${listened ? 'off' : 'on'}`)

            if (!listened) {
              const logs = allLogs.get(c) ?? []
              logs.forEach(([type, ...args]) => {
                if (type === 'logImage') {
                  logImage(args[0], ...args.slice(1))
                } else {
                  console[type](...args)
                }
              })
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
            loadLocalSetting()

            const addLog = (type: LogType, ...args: any[]) => {
              if (process.env.NODE_ENV === 'production') return

              const logArgs = [
                `%c[🤖 #${c}]%c`,
                `color: ${colors[c][1]}; font-weight: bold; background: ${colors[c][0]}; padding: 2px 4px; border-radius: 2px;`,
                '',
                ...args,
              ]

              const logs = allLogs.get(c) ?? []
              logs.push([type, ...logArgs])
              allLogs.set(c, logs.slice(-20))

              if (listens.has(c) && globalOn) {
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
  ;(window as any).logc = LogChannel
}

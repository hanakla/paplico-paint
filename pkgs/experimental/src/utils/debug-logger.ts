/** デバッグログレベル */
export type DebugLogLevel = 'error' | 'warn' | 'info' | 'debug'

/** デバッグログエントリ */
export interface DebugLogEntry {
  level: DebugLogLevel
  message: string
  context?: Record<string, any>
  timestamp?: string
}

/** デバッグログ送信クライアント */
export class DebugLogger {
  private endpoint = '/api/debug-log'
  private queue: DebugLogEntry[] = []
  private paused = false
  private sending = false
  private lastSent: number = 0
  private sendInterval: number = 400 // 400ミリ秒ごとに送信

  async clear() {
    await fetch(this.endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /** エラーログを送信 */
  async error(message: string, context?: Record<string, any>) {
    console.error(message, context)
    return this.log('error', message, context)
  }

  /** 警告ログを送信 */
  async warn(message: string, context?: Record<string, any>) {
    console.warn(message, context)
    return this.log('warn', message, context)
  }

  /** 情報ログを送信 */
  async info(message: string, context?: Record<string, any>) {
    console.info(message, context)
    return this.log('info', message, context)
  }

  /** デバッグログを送信 */
  async debug(message: string, context?: Record<string, any>) {
    console.debug(message, context)
    return this.log('debug', message, context)
  }

  /** レンダリング状態をデバッグログとして送信 */
  async logRenderingState(state: {
    documentId?: string
    artboardCount?: number
    totalLayerCount?: number
    totalPathCount?: number
    renderPassCount?: number
    currentStrokePoints?: number
    brushRendererInitialized?: boolean
    fillRendererInitialized?: boolean
    errors?: string[]
    performance?: Record<string, number>
  }) {
    console.debug('Rendering state:', state)
    return this.log('debug', 'Rendering state', {
      type: 'rendering_state',
      ...state,
    })
  }

  /** WebGPUエラー情報をログ */
  async logWebGPUError(error: any, context?: Record<string, any>) {
    console.error('WebGPU Error:', error, context)
    return this.log('error', 'WebGPU Error', {
      type: 'webgpu_error',
      error: error?.message || String(error),
      stack: error?.stack,
      ...context,
    })
  }

  /** シェーダーコンパイルエラーをログ */
  async logShaderError(shaderCode: string, error: any) {
    console.error('Shader compilation failed:', error, shaderCode)
    return this.log('error', 'Shader compilation failed', {
      type: 'shader_error',
      shaderCode,
      error: error?.message || String(error),
    })
  }

  /** パフォーマンス測定結果をログ */
  async logPerformance(
    name: string,
    duration: number,
    context?: Record<string, any>,
  ) {
    console.info(`Performance: ${name} - ${duration}ms`, context)
    return this.log('info', `Performance: ${name}`, {
      type: 'performance',
      name,
      duration,
      ...context,
    })
  }

  private async log(
    level: DebugLogLevel,
    message: string,
    context?: Record<string, any>,
  ) {
    const entry: DebugLogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    }

    // キューに追加
    this.queue.push(entry)

    // 非同期で送信を試行
    this.procesQueue()
  }

  private async procesQueue() {
    if (
      this.sending ||
      this.queue.length === 0 ||
      Date.now() - this.lastSent < this.sendInterval
    ) {
      return
    }

    this.sending = true

    try {
      await this.sendLog(this.queue)
      this.queue = [] // 送信後はキューをクリア
    } catch (error) {
      console.error('Failed to send debug log:', error)
    } finally {
      this.sending = false
    }
  }

  private async sendLog(entries: DebugLogEntry[]) {
    if (this.paused || entries.length === 0) {
      return
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entries),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      // ネットワークエラーなどの場合はコンソールにログを出力
      console.error('Debug log send failed:', error, entries)
      throw error
    } finally {
      this.lastSent = Date.now()
    }
  }
}

/** グローバルデバッグロガーインスタンス */
export const debugLogger = new DebugLogger()

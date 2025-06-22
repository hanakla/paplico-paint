import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'

const DEBUG_LOG_DIR = join(process.cwd(), 'debug-logs')

function getLogFilePath() {
  const logFileName = `debug.log`
  const logFilePath = join(DEBUG_LOG_DIR, logFileName)
  return logFilePath
}

export async function DELETE(_request: NextRequest) {
  // デバッグログディレクトリを削除
  await writeFile(getLogFilePath(), '', { flag: 'w' })
  return NextResponse.json({ success: true })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Invalid request body format' },
        { status: 400 },
      )
    }

    const lines: string[] = []
    for (const { level, message, context, timestamp } of body) {
      if (!level || !message) {
        return NextResponse.json(
          { error: 'level and message are required' },
          { status: 400 },
        )
      }

      // デバッグログディレクトリを作成
      await mkdir(DEBUG_LOG_DIR, { recursive: true })

      // ログエントリを作成
      const logEntry = {
        timestamp: timestamp || new Date().toISOString(),
        level,
        message,
        context: context || {},
      }

      const logLine = `${JSON.stringify(logEntry)}\n`
      lines.push(logLine)
    }

    // ファイルに追記
    await writeFile(getLogFilePath(), lines.join(''), { flag: 'a' })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to write debug log:', error)
    return NextResponse.json(
      { error: 'Failed to write debug log' },
      { status: 500 },
    )
  }
}

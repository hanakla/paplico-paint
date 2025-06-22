import fs from 'node:fs/promises'
import path from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'

export interface SaveJSONData {
  filename: string
  data: any
}

/**
 * デバッグ用。`POST /api/debug/save-json`に { filename: string, data: any} のペイロードを送ると
 * <root>/debug-logs/<filename>.jsonに保存されます。 ただし最新１件のデータのみです。
 */
export async function POST(request: NextRequest) {
  try {
    const data: SaveJSONData = await request.json()

    // ログディレクトリの確保
    const logDir = path.join(process.cwd(), 'debug-logs')
    await fs.mkdir(logDir, { recursive: true })

    // ログファイルパス
    const logFile = path.join(logDir, `${data.filename}.json`)

    try {
      await fs.writeFile(logFile, JSON.stringify(data.data))
    } catch (e) {
      console.log('Failed to write JSON data, trying to stringify it first', e)
    }

    // await fs.writeFile(logFile, data.data.toString())

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to write debug log:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

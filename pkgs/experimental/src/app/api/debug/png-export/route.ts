import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export interface PngExportDebugData {
  timestamp: number
  success: boolean
  error?: string
  artboards: {
    id: string
    name: string
    bounds: { x: number; y: number; width: number; height: number }
    artObjectCount: number
  }[]
  exportStats: {
    totalArtboards: number
    exportedArtboards: number
    renderTime: number
    imageData?: {
      width: number
      height: number
      alphaMin: number
      alphaMax: number
      nonTransparentPixels: number
      totalPixels: number
    }
  }
  renderingDetails?: {
    layersProcessed: number
    artObjectsProcessed: number
    visibleLayers: number
    pathsRendered: number
    fillsRendered: number
    strokesRendered: number
    skippedObjects: number
    renderErrors: string[]
  }
  debugErrors?: string[]
  // base64Imageは大きいので記録しない
}

export async function POST(request: NextRequest) {
  try {
    const data: PngExportDebugData = await request.json()

    // ログディレクトリの確保
    const logDir = path.join(process.cwd(), 'debug-logs')
    await fs.mkdir(logDir, { recursive: true })

    // ログファイルパス
    const logFile = path.join(logDir, 'png-export-debug.json')

    // デバッグデータを1行のJSONとして追記（JSONL形式）
    const logEntry =
      JSON.stringify({
        ...data,
        // 分析に役立つ追加情報
        transparentRatio: data.exportStats.imageData
          ? (data.exportStats.imageData.totalPixels -
              data.exportStats.imageData.nonTransparentPixels) /
            data.exportStats.imageData.totalPixels
          : null,
        hasContent: (data.exportStats.imageData?.nonTransparentPixels || 0) > 0,
        // 簡潔なサマリー
        summary: `${data.success ? 'OK' : 'FAIL'} - Artboards: ${
          data.exportStats.totalArtboards
        }, Exported: ${data.exportStats.exportedArtboards}, Transparent: ${
          data.exportStats.imageData?.nonTransparentPixels === 0 ? 'YES' : 'NO'
        }`,
        debugErrors: data.debugErrors || [],
      }) + '\n'

    await fs.writeFile(logFile, logEntry)

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

'use client'

import { Image, Send } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import type { PngExportDebugData } from '@/app/api/debug/png-export/route'
import { Button } from '@/components/ui/button'
import { PngAllArtboardExporter } from '@/engine/exporters/PngAllArtboardExporter'
import type { PaplicoEngine } from '@/engine/paplico'
import { debugState } from '@/engine/webgpu/core-engine'

export const AutoPngSection = memo(
  ({ engine }: { engine: PaplicoEngine | null }) => {
    const [pngDataUrl, setPngDataUrl] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [isEnabled, setIsEnabled] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isSending, setIsSending] = useState(false)
    const [_apiResponse, _setApiResponse] = useState<any>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const captureImage = async () => {
      if (!engine || !engine.getEngine()) {
        setError('エンジンが初期化されていません')
        return
      }

      const startTime = performance.now()
      const debugData: PngExportDebugData = {
        timestamp: Date.now(),
        success: false,
        artboards: [],
        exportStats: {
          totalArtboards: 0,
          exportedArtboards: 0,
          renderTime: 0,
        },
      }

      try {
        const webgpuEngine = engine.getEngine()
        const documentContext = engine.getActiveDocumentContext()

        if (!documentContext) {
          debugData.error = 'アクティブドキュメントがありません'
          setError(debugData.error)
          await sendDebugData(debugData)
          return
        }

        // 最初のアートボードを選択
        const document = documentContext.document

        if (!document || !document.artboards) {
          debugData.error = 'ドキュメントまたはアートボードがありません'
          setError(debugData.error)
          await sendDebugData(debugData)
          return
        }

        // artboardsはオブジェクトなので、値の配列に変換
        const artboardsArray = Object.values(document.artboards)
        debugData.exportStats.totalArtboards = artboardsArray.length

        // アートボード情報を収集
        debugData.artboards = artboardsArray.map((ab: any) => ({
          id: ab.id,
          name: ab.name || ab.id,
          bounds: ab.bounds,
          artObjectCount: Object.values(document.artObjects).filter(
            (obj: any) => {
              if (obj.type !== 'path' || !obj.path?.points) return false
              const transformX = obj.transform?.x || 0
              const transformY = obj.transform?.y || 0
              const xs = obj.path.points.map((p: any) => p.x + transformX)
              const ys = obj.path.points.map((p: any) => p.y + transformY)
              const minX = Math.min(...xs),
                maxX = Math.max(...xs)
              const minY = Math.min(...ys),
                maxY = Math.max(...ys)
              return !(
                maxX < ab.bounds.x ||
                minX > ab.bounds.x + ab.bounds.width ||
                maxY < ab.bounds.y ||
                minY > ab.bounds.y + ab.bounds.height
              )
            },
          ).length,
        }))

        if (artboardsArray.length === 0) {
          debugData.error = 'アートボード配列が空です'
          setError(debugData.error)
          await sendDebugData(debugData)
          return
        }

        const firstArtboard = artboardsArray[0] as any
        const exporter = new PngAllArtboardExporter({
          selectedArtboardIds: [firstArtboard.id],
        })

        // PNG化実行
        const files = await exporter.export(
          documentContext,
          webgpuEngine as any,
        )

        debugData.exportStats.exportedArtboards = files.length
        debugData.exportStats.renderTime = performance.now() - startTime

        // エクスポート後に少し待ってからdebugStateを取得
        await new Promise((resolve) => setTimeout(resolve, 10))

        // 最新のスナップショットを取得（直接debugStateを参照）
        const latestSnapshot = debugState.export

        // debugStateから詳細情報を取得
        if (latestSnapshot.imageData) {
          debugData.exportStats.imageData = { ...latestSnapshot.imageData }
        }
        if (latestSnapshot.rendering) {
          debugData.renderingDetails = {
            layersProcessed: latestSnapshot.rendering.layersProcessed,
            artObjectsProcessed: latestSnapshot.rendering.artObjectsProcessed,
            visibleLayers: latestSnapshot.rendering.visibleLayers,
            pathsRendered: latestSnapshot.rendering.pathsRendered,
            fillsRendered: latestSnapshot.rendering.fillsRendered,
            strokesRendered: latestSnapshot.rendering.strokesRendered,
            skippedObjects: latestSnapshot.rendering.skippedObjects,
            renderErrors: latestSnapshot.rendering.renderErrors.map(
              (e: any) => e.error,
            ),
          }
        }

        if (files.length > 0) {
          // Fileオブジェクトをdata URLに変換
          const reader = new FileReader()
          reader.onload = async (e) => {
            const dataUrl = e.target?.result as string
            setPngDataUrl(dataUrl)
            setLastUpdate(new Date())
            setError(null)

            // base64Imageはサイズが大きいのでAPIには送らない
            debugData.success = true
            await sendDebugData(debugData)
          }
          reader.readAsDataURL(files[0])
        } else {
          debugData.error = 'PNG化に失敗しました'
          setError(debugData.error)
          await sendDebugData(debugData)
        }
      } catch (err) {
        console.error('PNG capture error:', err)
        debugData.error = err instanceof Error ? err.message : 'PNG化エラー'
        setError(debugData.error)
        await sendDebugData(debugData)
      }
    }

    const sendDebugData = async (data: PngExportDebugData) => {
      setIsSending(true)
      try {
        const response = await fetch('/api/debug/png-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          console.error('Debug API error:', response.status)
        }
      } catch (err) {
        console.error('Failed to send debug data:', err)
      } finally {
        setIsSending(false)
      }
    }

    useEffect(() => {
      if (isEnabled) {
        // 即座に最初のキャプチャを実行
        captureImage()

        // 5秒ごとにキャプチャ
        intervalRef.current = setInterval(() => {
          captureImage()
        }, 5000)
      } else {
        // タイマークリア
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }, [isEnabled, captureImage])

    return (
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium flex items-center gap-1">
            <Image className="w-3 h-3" />
            自動PNG化
          </span>
          <div className="flex items-center gap-1">
            {isSending && <Send className="w-3 h-3 animate-pulse" />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEnabled(!isEnabled)}
              className="h-6 px-2 py-0 text-xs"
            >
              {isEnabled ? 'Stop' : 'Start'}
            </Button>
          </div>
        </div>
        <div className="border rounded p-2 space-y-2">
          {/* ステータス */}
          <div className="text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span>状態:</span>
              <span
                className={
                  isEnabled ? 'text-green-600' : 'text-muted-foreground'
                }
              >
                {isEnabled ? '有効 (5秒ごと)' : '無効'}
              </span>
            </div>
            {lastUpdate && (
              <div className="flex items-center justify-between">
                <span>最終更新:</span>
                <span className="font-mono">
                  {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
            )}
            {error && <div className="text-red-600 text-xs">{error}</div>}
          </div>

          {/* プレビュー画像 */}
          {pngDataUrl && (
            <div className="space-y-1">
              <div className="text-xs font-medium">プレビュー</div>
              <div
                className="relative bg-checkered rounded overflow-hidden"
                style={{ aspectRatio: '16/9' }}
              >
                <img
                  src={pngDataUrl}
                  alt="Canvas preview"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = pngDataUrl
                  link.download = `canvas-${new Date().toISOString()}.png`
                  link.click()
                }}
                className="w-full h-6 text-xs"
              >
                ダウンロード
              </Button>
            </div>
          )}

          {/* デバッグ情報 */}
          {isEnabled && !pngDataUrl && !error && (
            <div className="text-xs text-muted-foreground italic">
              キャプチャ中...
            </div>
          )}
        </div>
      </div>
    )
  },
)

AutoPngSection.displayName = 'AutoPngSection'

'use client'

import { memo, useState, useEffect, useRef } from 'react'
import { useSnapshot } from 'valtio'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Bug, ChevronRight, Copy, Check, Image, Send } from 'lucide-react'
import { PaplicoEngine } from '@/engine/paplico'
import { debugState } from '@/engine/webgpu/core-engine'
import { StrokeDebugSection } from './StrokeDebugSection'
import { PngAllArtboardExporter } from '@/engine/exporters/PngAllArtboardExporter'
import type { PngExportDebugData } from '@/app/api/debug/png-export/route'
import { useNullishSnapshot } from '@/lib/hooks'

interface DebugPaneProps {
  engine: PaplicoEngine | null
  isOpen: boolean
}

// デバッグ情報をテキスト形式でフォーマット
const formatDebugInfo = (debugSnapshot: any): string => {
  const lines: string[] = []

  lines.push('=== UI システム診断情報 ===')
  lines.push('')

  // 診断結果
  lines.push('【診断結果】')
  if (debugSnapshot.ui.componentCount === 0) {
    lines.push('❌ UIコンポーネントが登録されていません')
  }
  if (debugSnapshot.ui.elementsGenerated === 0) {
    lines.push('❌ UI要素が生成されていません')
  }
  if (
    debugSnapshot.ui.elementsGenerated > 0 &&
    debugSnapshot.ui.elementsRendered === 0
  ) {
    lines.push('❌ UI要素が描画されていません')
  }
  if (
    debugSnapshot.ui.renderPasses.background.count === 0 &&
    debugSnapshot.ui.renderPasses.legacy.count === 0
  ) {
    lines.push('❌ UIレンダーパスが実行されていません')
  }
  if (debugSnapshot.ui.errorCount > 0) {
    lines.push(`❌ エラーが発生しています (${debugSnapshot.ui.errorCount}件)`)
    if (debugSnapshot.ui.lastError) {
      lines.push(`   最新エラー: ${debugSnapshot.ui.lastError}`)
    }
  }

  // 問題がない場合
  if (
    debugSnapshot.ui.componentCount > 0 &&
    debugSnapshot.ui.elementsGenerated > 0 &&
    debugSnapshot.ui.elementsRendered > 0 &&
    debugSnapshot.ui.errorCount === 0
  ) {
    lines.push('✅ UIシステムは正常に動作しています')
  }
  lines.push('')

  // 統計情報
  lines.push('【統計情報】')
  lines.push(`コンポーネント数: ${debugSnapshot.ui.componentCount}`)
  lines.push(`生成要素数: ${debugSnapshot.ui.elementsGenerated}`)
  lines.push(`描画要素数: ${debugSnapshot.ui.elementsRendered}`)
  lines.push(
    `最終レンダー時間: ${debugSnapshot.ui.lastRenderTime.toFixed(2)}ms`,
  )
  lines.push(`エラー数: ${debugSnapshot.ui.errorCount}`)
  lines.push('')

  // レンダーパス情報
  lines.push('【レンダーパス】')
  lines.push(
    `背景パス: ${
      debugSnapshot.ui.renderPasses.background.count
    }回 (${debugSnapshot.ui.renderPasses.background.duration.toFixed(2)}ms)`,
  )
  lines.push(
    `前景パス: ${
      debugSnapshot.ui.renderPasses.foreground.count
    }回 (${debugSnapshot.ui.renderPasses.foreground.duration.toFixed(2)}ms)`,
  )
  lines.push(
    `レガシーパス: ${
      debugSnapshot.ui.renderPasses.legacy.count
    }回 (${debugSnapshot.ui.renderPasses.legacy.duration.toFixed(2)}ms)`,
  )
  lines.push('')

  // アクティブコンポーネント
  if (debugSnapshot.ui.activeComponents.length > 0) {
    lines.push('【アクティブコンポーネント】')
    debugSnapshot.ui.activeComponents.forEach(
      (component: string, index: number) => {
        lines.push(`${index + 1}. ${component}`)
      },
    )
    lines.push('')
  }

  // 描画順序
  if (debugSnapshot.ui.drawOrder.length > 0) {
    lines.push('【描画順序 (最新10件)】')
    debugSnapshot.ui.drawOrder
      .slice(-10)
      .forEach((drawStep: any, index: number) => {
        let line = `${index + 1}. ${drawStep.type}`
        if (drawStep.elementId) {
          line += ` → ${drawStep.elementType}#${drawStep.elementId.slice(-6)}`
        }
        if (drawStep.zIndex !== undefined) {
          line += ` (z:${drawStep.zIndex})`
        }
        if (drawStep.position) {
          line += ` pos:(${drawStep.position.x},${drawStep.position.y})`
        }
        lines.push(line)
      })
    lines.push('')
  }

  // WebGPU描画呼び出し
  if (debugSnapshot.ui.renderCalls.length > 0) {
    lines.push('【WebGPU描画呼び出し (最新10件)】')
    debugSnapshot.ui.renderCalls
      .slice(-10)
      .forEach((call: any, index: number) => {
        let line = `${index + 1}. ${call.callType}(${call.pipelineType})`
        if (call.elementId) {
          line += ` #${call.elementId.slice(-6)}`
        }
        lines.push(line)
      })
    lines.push('')
  }

  lines.push(`生成日時: ${new Date().toLocaleString()}`)

  return lines.join('\n')
}

// UIデバッグセクションコンポーネント
const UIDebugSection = memo(() => {
  const debugSnapshot = useSnapshot(debugState)
  const [isCopied, setIsCopied] = useState(false)

  const copyDebugInfo = async () => {
    const debugInfo = formatDebugInfo(debugSnapshot)
    try {
      await navigator.clipboard.writeText(debugInfo)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy debug info:', err)
    }
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">UI システム診断</span>
        <Button
          variant="outline"
          size="sm"
          onClick={copyDebugInfo}
          className="h-6 px-2 py-0 text-xs"
        >
          {isCopied ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              コピー済み
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              コピー
            </>
          )}
        </Button>
      </div>
      <div className="border rounded space-y-2 p-2">
        {/* 診断結果 */}
        <div className="space-y-1">
          <div className="font-medium text-xs mb-1">診断結果</div>

          {/* 重大な問題 */}
          {debugSnapshot.ui.componentCount === 0 && (
            <div className="text-red-600 text-xs">
              ❌ UIコンポーネントが登録されていません
            </div>
          )}
          {debugSnapshot.ui.elementsGenerated === 0 && (
            <div className="text-red-600 text-xs">
              ❌ UI要素が生成されていません
            </div>
          )}
          {debugSnapshot.ui.elementsGenerated > 0 &&
            debugSnapshot.ui.elementsRendered === 0 && (
              <div className="text-red-600 text-xs">
                ❌ UI要素が描画されていません
              </div>
            )}
          {debugSnapshot.ui.renderPasses.background.count === 0 &&
            debugSnapshot.ui.renderPasses.legacy.count === 0 && (
              <div className="text-red-600 text-xs">
                ❌ UIレンダーパスが実行されていません
              </div>
            )}
          {debugSnapshot.ui.errorCount > 0 && (
            <div className="text-red-600 text-xs">
              ❌ UIエラーが{debugSnapshot.ui.errorCount}件発生
            </div>
          )}

          {/* 警告 */}
          {debugSnapshot.ui.lastRenderTime === 0 &&
            debugSnapshot.ui.elementsGenerated > 0 && (
              <div className="text-yellow-600 text-xs">
                ⚠️ レンダリング時間が0ms
              </div>
            )}
          {debugSnapshot.ui.activeComponents.length === 0 &&
            debugSnapshot.ui.componentCount > 0 && (
              <div className="text-yellow-600 text-xs">
                ⚠️ コンポーネントが非アクティブ
              </div>
            )}

          {/* 正常状態 */}
          {debugSnapshot.ui.componentCount > 0 &&
            debugSnapshot.ui.elementsGenerated > 0 &&
            debugSnapshot.ui.elementsRendered > 0 &&
            debugSnapshot.ui.errorCount === 0 && (
              <div className="text-green-600 text-xs">
                ✅ UI システムは正常に動作しています
              </div>
            )}
        </div>

        {/* 基本統計 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">基本統計</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>UIコンポーネント数:</span>
            <span className="font-mono text-right">
              {debugSnapshot.ui.componentCount}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>生成UI要素数:</span>
            <span className="font-mono text-right">
              {debugSnapshot.ui.elementsGenerated}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>描画UI要素数:</span>
            <span className="font-mono text-right">
              {debugSnapshot.ui.elementsRendered}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>最終レンダリング時間:</span>
            <span className="font-mono text-right">
              {debugSnapshot.ui.lastRenderTime.toFixed(2)}ms
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>UIエラー数:</span>
            <span className="font-mono text-right">
              {debugSnapshot.ui.errorCount}
            </span>
          </div>
          {debugSnapshot.ui.lastError && (
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>最新エラー:</span>
              <span className="text-right text-red-600">
                {debugSnapshot.ui.lastError.slice(0, 30)}...
              </span>
            </div>
          )}
        </div>

        {/* レンダーパス統計 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">レンダーパス統計</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>背景パス:</span>
            <span className="font-mono text-right">
              {debugSnapshot.ui.renderPasses.background.count}回 (
              {debugSnapshot.ui.renderPasses.background.duration.toFixed(2)}ms)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>前景パス:</span>
            <span className="font-mono text-right">
              {debugSnapshot.ui.renderPasses.foreground.count}回 (
              {debugSnapshot.ui.renderPasses.foreground.duration.toFixed(2)}ms)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>レガシーパス:</span>
            <span className="font-mono text-right">
              {debugSnapshot.ui.renderPasses.legacy.count}回 (
              {debugSnapshot.ui.renderPasses.legacy.duration.toFixed(2)}ms)
            </span>
          </div>
        </div>

        {/* アクティブコンポーネント */}
        {debugSnapshot.ui.activeComponents.length > 0 && (
          <div className="space-y-0">
            <div className="font-medium text-xs mb-1">
              アクティブコンポーネント
            </div>
            <div className="space-y-0">
              {debugSnapshot.ui.activeComponents.map(
                (componentName: string, index: number) => (
                  <div key={index} className="text-xs font-mono">
                    • {componentName}
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {/* 描画順序 */}
        {debugSnapshot.ui.drawOrder.length > 0 && (
          <div className="space-y-0">
            <div className="font-medium text-xs mb-1">描画順序 (最新10件)</div>
            <div className="space-y-0 max-h-32 overflow-y-auto">
              {debugSnapshot.ui.drawOrder
                .slice(-10)
                .map((drawStep: any, index: number) => (
                  <div key={index} className="text-xs font-mono">
                    {index + 1}. {drawStep.type}
                    {drawStep.elementId &&
                      ` → ${drawStep.elementType}#${drawStep.elementId.slice(
                        -6,
                      )}`}
                    {drawStep.zIndex !== undefined && ` (z:${drawStep.zIndex})`}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* WebGPU描画呼び出し */}
        {debugSnapshot.ui.renderCalls.length > 0 && (
          <div className="space-y-0">
            <div className="font-medium text-xs mb-1">
              WebGPU描画呼び出し (最新5件)
            </div>
            <div className="space-y-0 max-h-24 overflow-y-auto">
              {debugSnapshot.ui.renderCalls
                .slice(-5)
                .map((call: any, index: number) => (
                  <div key={index} className="text-xs font-mono">
                    {call.callType}({call.pipelineType})
                    {call.elementId && ` #${call.elementId.slice(-6)}`}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

UIDebugSection.displayName = 'UIDebugSection'

// エクスポート情報をテキスト形式でフォーマット
const formatExportInfo = (debugSnapshot: any): string => {
  const lines: string[] = []

  lines.push('=== エクスポート診断情報 ===')
  lines.push('')

  // アートボード情報
  if (debugSnapshot.export?.artboard?.name) {
    lines.push('【アートボード情報】')
    lines.push(`対象アートボード: ${debugSnapshot.export.artboard.name}`)
    if (debugSnapshot.export.artboard.bounds) {
      const bounds = debugSnapshot.export.artboard.bounds
      lines.push(
        `アートボード境界: ${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`,
      )
      lines.push(
        `含有オブジェクト数: ${debugSnapshot.export.artboard.artObjectsInside}`,
      )
    }
    if (
      debugSnapshot.export.artboard.renderEndTime &&
      debugSnapshot.export.artboard.renderStartTime
    ) {
      const renderTime =
        debugSnapshot.export.artboard.renderEndTime -
        debugSnapshot.export.artboard.renderStartTime
      lines.push(`レンダリング時間: ${renderTime.toFixed(2)}ms`)
    }
    lines.push('')
  }

  // カメラ情報
  if (debugSnapshot.export?.camera?.originalPosition) {
    lines.push('【カメラ変換】')
    lines.push(
      `元の位置: ${debugSnapshot.export.camera.originalPosition.x.toFixed(
        1,
      )},${debugSnapshot.export.camera.originalPosition.y.toFixed(1)}`,
    )
    lines.push(
      `新しい位置: ${
        debugSnapshot.export.camera.newPosition?.x?.toFixed(1) || 0
      },${debugSnapshot.export.camera.newPosition?.y?.toFixed(1) || 0}`,
    )
    lines.push(
      `元のズーム: ${debugSnapshot.export.camera.originalZoom.toFixed(3)}`,
    )
    lines.push(
      `新しいズーム: ${debugSnapshot.export.camera.newZoom.toFixed(3)}`,
    )
    lines.push('')
  }

  // テクスチャ情報
  if (debugSnapshot.export?.texture?.width > 0) {
    lines.push('【テクスチャ情報】')
    lines.push(
      `テクスチャサイズ: ${debugSnapshot.export.texture.width}x${debugSnapshot.export.texture.height}`,
    )
    lines.push(`フォーマット: ${debugSnapshot.export.texture.format}`)
    if (
      debugSnapshot.export.texture.readEndTime &&
      debugSnapshot.export.texture.readStartTime
    ) {
      const readTime =
        debugSnapshot.export.texture.readEndTime -
        debugSnapshot.export.texture.readStartTime
      lines.push(`読み取り時間: ${readTime.toFixed(2)}ms`)
    }
    lines.push(
      `読み取りバイト数: ${(
        debugSnapshot.export.texture.bytesRead / 1024
      ).toFixed(1)}KB`,
    )
    lines.push('')
  }

  // ImageData分析
  if (debugSnapshot.export?.imageData?.width > 0) {
    lines.push('【ImageData分析】')
    lines.push(
      `画像サイズ: ${debugSnapshot.export.imageData.width}x${debugSnapshot.export.imageData.height}`,
    )
    lines.push(
      `不透明ピクセル数: ${debugSnapshot.export.imageData.nonTransparentPixels}`,
    )
    lines.push(`総ピクセル数: ${debugSnapshot.export.imageData.totalPixels}`)
    const transparencyPercent = (
      (debugSnapshot.export.imageData.nonTransparentPixels /
        debugSnapshot.export.imageData.totalPixels) *
      100
    ).toFixed(1)
    lines.push(`透明度: ${transparencyPercent}%`)
    lines.push(
      `アルファ値範囲: ${debugSnapshot.export.imageData.alphaMin} - ${debugSnapshot.export.imageData.alphaMax}`,
    )

    // 診断結果
    if (debugSnapshot.export.imageData.nonTransparentPixels === 0) {
      lines.push('')
      lines.push('❌ 画像が完全に透明です')
      if (debugSnapshot.export.artboard.artObjectsInside === 0) {
        lines.push('   → アートボード内にコンテンツがありません')
      } else {
        lines.push('   → レンダリングに問題があります')
      }
    } else {
      lines.push('')
      lines.push('✅ 画像に可視コンテンツが含まれています')
    }
    lines.push('')
  }

  // エラー情報
  if (debugSnapshot.export?.errors && debugSnapshot.export.errors.length > 0) {
    lines.push('【エラー情報】')
    debugSnapshot.export.errors.forEach((error: string, index: number) => {
      lines.push(`${index + 1}. ${error}`)
    })
    lines.push('')
  }

  if (!debugSnapshot.export?.artboard?.name) {
    lines.push('エクスポート未実行')
  }

  lines.push(`生成日時: ${new Date().toLocaleString()}`)

  return lines.join('\n')
}

// エクスポートデバッグセクションコンポーネント
const ExportDebugSection = memo(() => {
  const debugSnapshot = useSnapshot(debugState)
  const [isCopied, setIsCopied] = useState(false)

  const copyExportInfo = async () => {
    const exportInfo = formatExportInfo(debugSnapshot)
    try {
      await navigator.clipboard.writeText(exportInfo)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy export info:', err)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">エクスポート診断</span>
        <Button
          variant="outline"
          size="sm"
          onClick={copyExportInfo}
          className="h-6 px-2 py-0 text-xs"
        >
          {isCopied ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              コピー済み
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              コピー
            </>
          )}
        </Button>
      </div>
      <div className="border rounded p-1 space-y-0">
        {/* アートボード情報 */}
        <div className="grid grid-cols-2 gap-1">
          <span>対象アートボード:</span>
          <span className="font-mono text-xs">
            {debugSnapshot.export?.artboard?.name || 'なし'}
          </span>
        </div>
        {debugSnapshot.export?.artboard?.bounds && (
          <>
            <div className="grid grid-cols-2 gap-1">
              <span>アートボード境界:</span>
              <span className="font-mono text-xs">
                {debugSnapshot.export.artboard.bounds.x},
                {debugSnapshot.export.artboard.bounds.y}
                {debugSnapshot.export.artboard.bounds.width}x
                {debugSnapshot.export.artboard.bounds.height}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>含有オブジェクト数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.artboard.artObjectsInside}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>レンダリング時間:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.artboard.renderEndTime &&
                debugSnapshot.export.artboard.renderStartTime
                  ? (
                      debugSnapshot.export.artboard.renderEndTime -
                      debugSnapshot.export.artboard.renderStartTime
                    ).toFixed(2)
                  : 0}
                ms
              </span>
            </div>
          </>
        )}

        {/* カメラ情報 */}
        {debugSnapshot.export?.camera?.originalPosition && (
          <>
            <div className="text-xs font-medium mt-1 mb-1">カメラ変換</div>
            <div className="grid grid-cols-2 gap-1">
              <span>元の位置:</span>
              <span className="font-mono text-xs">
                {debugSnapshot.export.camera.originalPosition.x.toFixed(1)},
                {debugSnapshot.export.camera.originalPosition.y.toFixed(1)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>新しい位置:</span>
              <span className="font-mono text-xs">
                {debugSnapshot.export.camera.newPosition?.x?.toFixed(1) || 0},
                {debugSnapshot.export.camera.newPosition?.y?.toFixed(1) || 0}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>元のズーム:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.camera.originalZoom.toFixed(3)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>新しいズーム:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.camera.newZoom.toFixed(3)}
              </span>
            </div>
          </>
        )}

        {/* テクスチャ情報 */}
        {debugSnapshot.export?.texture?.width > 0 && (
          <>
            <div className="text-xs font-medium mt-1 mb-1">テクスチャ情報</div>
            <div className="grid grid-cols-2 gap-1">
              <span>テクスチャサイズ:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.texture.width}x
                {debugSnapshot.export.texture.height}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>フォーマット:</span>
              <span className="text-right">
                {debugSnapshot.export.texture.format}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>読み取り時間:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.texture.readEndTime &&
                debugSnapshot.export.texture.readStartTime
                  ? (
                      debugSnapshot.export.texture.readEndTime -
                      debugSnapshot.export.texture.readStartTime
                    ).toFixed(2)
                  : 0}
                ms
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>読み取りバイト数:</span>
              <span className="font-mono text-right">
                {(debugSnapshot.export.texture.bytesRead / 1024).toFixed(1)}KB
              </span>
            </div>
          </>
        )}

        {/* レンダリング統計 */}
        {debugSnapshot.export?.rendering && (
          <>
            <div className="text-xs font-medium mt-1 mb-1">
              レンダリング統計
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>処理レイヤー数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.rendering.layersProcessed}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>処理オブジェクト数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.rendering.artObjectsProcessed}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>描画パス数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.rendering.pathsRendered}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>塗り描画数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.rendering.fillsRendered}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>ストローク描画数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.rendering.strokesRendered}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>スキップオブジェクト数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.rendering.skippedObjects}
              </span>
            </div>
            {debugSnapshot.export.rendering.renderErrors?.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-1">
                  <span>レンダリングエラー数:</span>
                  <span className="font-mono text-right text-red-600">
                    {debugSnapshot.export.rendering.renderErrors.length}
                  </span>
                </div>
                <div className="text-xs font-medium mt-1 mb-1 text-red-600">
                  レンダリングエラー詳細
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {debugSnapshot.export.rendering.renderErrors
                    .slice(0, 20)
                    .map((error: any, index: number) => {
                      // エラーメッセージを先頭20行に制限
                      const lines =
                        typeof error === 'string'
                          ? error.split('\n').slice(0, 20).join('\n')
                          : error.error || 'Unknown error'
                      return (
                        <div
                          key={index}
                          className="text-xs text-red-600 break-words"
                        >
                          {lines}
                        </div>
                      )
                    })}
                  {debugSnapshot.export.rendering.renderErrors.length > 20 && (
                    <div className="text-xs text-muted-foreground italic">
                      ...他{' '}
                      {debugSnapshot.export.rendering.renderErrors.length - 20}{' '}
                      件のエラー
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ImageData分析 */}
        {debugSnapshot.export?.imageData?.width > 0 && (
          <>
            <div className="text-xs font-medium mt-1 mb-1">ImageData分析</div>
            <div className="grid grid-cols-2 gap-1">
              <span>画像サイズ:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.imageData.width}x
                {debugSnapshot.export.imageData.height}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>不透明ピクセル数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.imageData.nonTransparentPixels}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>総ピクセル数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.imageData.totalPixels}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>透明度:</span>
              <span
                className={`font-mono text-right ${
                  debugSnapshot.export.imageData.nonTransparentPixels === 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {(
                  (debugSnapshot.export.imageData.nonTransparentPixels /
                    debugSnapshot.export.imageData.totalPixels) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>アルファ値範囲:</span>
              <span className="font-mono text-right">
                {debugSnapshot.export.imageData.alphaMin} -{' '}
                {debugSnapshot.export.imageData.alphaMax}
              </span>
            </div>

            {/* 診断結果 */}
            <div className="mt-1 pt-1 border-t border-border/50">
              {debugSnapshot.export.imageData.nonTransparentPixels === 0 ? (
                <div className="text-red-600 text-xs">
                  ❌ 画像が完全に透明です
                  {debugSnapshot.export.artboard?.artObjectsInside === 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      → アートボード内にコンテンツがありません
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-green-600 text-xs">
                  ✅ 画像に可視コンテンツが含まれています
                </div>
              )}
            </div>
          </>
        )}

        {/* エラー情報 */}
        {debugSnapshot.export?.errors &&
          debugSnapshot.export.errors.length > 0 && (
            <>
              <div className="text-xs font-medium mt-1 mb-1 text-red-600">
                エクスポートエラー
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {debugSnapshot.export.errors
                  .slice(0, 20)
                  .map((error: any, index: number) => {
                    // エラーメッセージを先頭20行に制限
                    const lines =
                      typeof error === 'string'
                        ? error.split('\n').slice(0, 20).join('\n')
                        : error.error || 'Unknown error'
                    return (
                      <div
                        key={index}
                        className="text-xs text-red-600 break-words"
                      >
                        {lines}
                      </div>
                    )
                  })}
                {debugSnapshot.export.errors.length > 20 && (
                  <div className="text-xs text-muted-foreground italic">
                    ...他 {debugSnapshot.export.errors.length - 20} 件のエラー
                  </div>
                )}
              </div>
            </>
          )}

        {/* エクスポート未実行時 */}
        {!debugSnapshot.export?.artboard?.name && (
          <div className="text-xs text-muted-foreground italic">
            エクスポート未実行
          </div>
        )}
      </div>
    </div>
  )
})

ExportDebugSection.displayName = 'ExportDebugSection'

// 移動情報をテキスト形式でフォーマット
const formatMovementInfo = (debugSnapshot: any): string => {
  const lines: string[] = []

  lines.push('=== 移動システム診断情報 ===')
  lines.push('')

  // 最後の移動コマンド
  if (debugSnapshot.movement?.lastMoveCommand) {
    const cmd = debugSnapshot.movement.lastMoveCommand
    lines.push('【最新移動コマンド】')
    lines.push(`実行時刻: ${new Date(cmd.timestamp).toLocaleTimeString()}`)
    lines.push(`対象オブジェクトID数: ${cmd.objectIds?.length || 0}`)
    if (cmd.objectIds?.length > 0) {
      lines.push(
        `対象オブジェクトID: ${cmd.objectIds
          .map((id: string) => id.slice(-6))
          .join(', ')}`,
      )
    }
    lines.push(
      `移動オフセット: (${cmd.offset?.x?.toFixed(1) || 0}, ${
        cmd.offset?.y?.toFixed(1) || 0
      })`,
    )
    lines.push(`実行結果: ${cmd.success ? '✅ 成功' : '❌ 失敗'}`)
    if (cmd.errorMessage) {
      lines.push(`エラー: ${cmd.errorMessage}`)
    }
    lines.push('')
  }

  // ドラッグ状態
  if (debugSnapshot.movement?.drag) {
    const drag = debugSnapshot.movement.drag
    lines.push('【ドラッグ状態】')
    lines.push(`ドラッグ中: ${drag.isDragging ? 'Yes' : 'No'}`)
    if (drag.startPosition) {
      lines.push(
        `開始位置: (${drag.startPosition.x?.toFixed(1) || 0}, ${
          drag.startPosition.y?.toFixed(1) || 0
        })`,
      )
    }
    if (drag.currentPosition) {
      lines.push(
        `現在位置: (${drag.currentPosition.x?.toFixed(1) || 0}, ${
          drag.currentPosition.y?.toFixed(1) || 0
        })`,
      )
    }
    if (drag.currentOffset) {
      lines.push(
        `現在オフセット: (${drag.currentOffset.x?.toFixed(1) || 0}, ${
          drag.currentOffset.y?.toFixed(1) || 0
        })`,
      )
    }
    lines.push(`選択オブジェクト数: ${drag.selectedObjectIds?.length || 0}`)
    if (drag.selectedObjectIds?.length > 0) {
      lines.push(
        `選択オブジェクトID: ${drag.selectedObjectIds
          .map((id: string) => id.slice(-6))
          .join(', ')}`,
      )
    }
    lines.push('')
  }

  // オブジェクト変換情報
  if (debugSnapshot.movement?.objectTransforms) {
    const transforms = debugSnapshot.movement.objectTransforms
    lines.push('【オブジェクト変換】')
    if (transforms.lastUpdateTime) {
      lines.push(
        `最終更新時刻: ${new Date(
          transforms.lastUpdateTime,
        ).toLocaleTimeString()}`,
      )
    }

    if (transforms.before && Object.keys(transforms.before).length > 0) {
      lines.push('変更前の位置:')
      Object.entries(transforms.before).forEach(([id, pos]: [string, any]) => {
        lines.push(
          `  ${id.slice(-6)}: (${pos.x?.toFixed(1) || 0}, ${
            pos.y?.toFixed(1) || 0
          })`,
        )
      })
    }

    if (transforms.after && Object.keys(transforms.after).length > 0) {
      lines.push('変更後の位置:')
      Object.entries(transforms.after).forEach(([id, pos]: [string, any]) => {
        lines.push(
          `  ${id.slice(-6)}: (${pos.x?.toFixed(1) || 0}, ${
            pos.y?.toFixed(1) || 0
          })`,
        )
      })
    }
    lines.push('')
  }

  // 実行ログ (最新10件)
  if (
    debugSnapshot.movement?.executionLog &&
    debugSnapshot.movement.executionLog.length > 0
  ) {
    lines.push('【実行ログ (最新10件)】')
    debugSnapshot.movement.executionLog
      .slice(-10)
      .forEach((log: any, index: number) => {
        const time = new Date(log.timestamp).toLocaleTimeString()
        lines.push(`${index + 1}. [${time}] ${log.action}`)
        if (log.data) {
          if (log.data.position) {
            lines.push(
              `   位置: (${log.data.position.x?.toFixed(1) || 0}, ${
                log.data.position.y?.toFixed(1) || 0
              })`,
            )
          }
          if (log.data.offset) {
            lines.push(
              `   オフセット: (${log.data.offset.x?.toFixed(1) || 0}, ${
                log.data.offset.y?.toFixed(1) || 0
              })`,
            )
          }
          if (log.data.selectedObjectIds || log.data.objectIds) {
            const ids = log.data.selectedObjectIds || log.data.objectIds
            lines.push(
              `   対象: ${ids.map((id: string) => id.slice(-6)).join(', ')}`,
            )
          }
          if (log.data.error) {
            lines.push(`   エラー: ${log.data.error}`)
          }
          if (log.data.willExecuteCommand !== undefined) {
            lines.push(
              `   コマンド実行: ${log.data.willExecuteCommand ? 'Yes' : 'No'}`,
            )
            if (log.data.reason) {
              lines.push(`   理由: ${log.data.reason}`)
            }
          }
        }
      })
    lines.push('')
  }

  if (!debugSnapshot.movement?.lastMoveCommand?.timestamp) {
    lines.push('移動コマンド未実行')
  }

  lines.push(`生成日時: ${new Date().toLocaleString()}`)

  return lines.join('\n')
}

// 移動デバッグセクションコンポーネント
const MovementDebugSection = memo(() => {
  const debugSnapshot = useSnapshot(debugState)
  const [isCopied, setIsCopied] = useState(false)

  const copyMovementInfo = async () => {
    const movementInfo = formatMovementInfo(debugSnapshot)
    try {
      await navigator.clipboard.writeText(movementInfo)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy movement info:', err)
    }
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">移動システム診断</span>
        <Button
          variant="outline"
          size="sm"
          onClick={copyMovementInfo}
          className="h-6 px-2 py-0 text-xs"
        >
          {isCopied ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              コピー済み
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              コピー
            </>
          )}
        </Button>
      </div>
      <div className="border rounded p-1 space-y-0">
        {/* 最新移動コマンド */}
        {debugSnapshot.movement?.lastMoveCommand && (
          <>
            <div className="text-xs font-medium mt-1 mb-1">
              最新移動コマンド
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>実行時刻:</span>
              <span className="font-mono text-xs">
                {debugSnapshot.movement.lastMoveCommand.timestamp
                  ? new Date(
                      debugSnapshot.movement.lastMoveCommand.timestamp,
                    ).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>対象オブジェクト数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.movement.lastMoveCommand.objectIds?.length || 0}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>移動オフセット:</span>
              <span className="font-mono text-xs">
                (
                {debugSnapshot.movement.lastMoveCommand.offset?.x?.toFixed(1) ||
                  0}
                ,{' '}
                {debugSnapshot.movement.lastMoveCommand.offset?.y?.toFixed(1) ||
                  0}
                )
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span>実行結果:</span>
              <span
                className={`text-xs ${
                  debugSnapshot.movement.lastMoveCommand.success
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {debugSnapshot.movement.lastMoveCommand.success
                  ? '✅ 成功'
                  : '❌ 失敗'}
              </span>
            </div>
            {debugSnapshot.movement.lastMoveCommand.errorMessage && (
              <div className="grid grid-cols-2 gap-1">
                <span>エラー:</span>
                <span className="text-xs text-red-600">
                  {debugSnapshot.movement.lastMoveCommand.errorMessage}
                </span>
              </div>
            )}
          </>
        )}

        {/* ドラッグ状態 */}
        {debugSnapshot.movement?.drag && (
          <>
            <div className="text-xs font-medium mt-1 mb-1">ドラッグ状態</div>
            <div className="grid grid-cols-2 gap-1">
              <span>ドラッグ中:</span>
              <span
                className={`text-xs ${
                  debugSnapshot.movement.drag.isDragging
                    ? 'text-yellow-600'
                    : 'text-muted-foreground'
                }`}
              >
                {debugSnapshot.movement.drag.isDragging ? 'Yes' : 'No'}
              </span>
            </div>
            {debugSnapshot.movement.drag.startPosition && (
              <div className="grid grid-cols-2 gap-1">
                <span>開始位置:</span>
                <span className="font-mono text-xs">
                  (
                  {debugSnapshot.movement.drag.startPosition.x?.toFixed(1) || 0}
                  ,{' '}
                  {debugSnapshot.movement.drag.startPosition.y?.toFixed(1) || 0}
                  )
                </span>
              </div>
            )}
            {debugSnapshot.movement.drag.currentPosition && (
              <div className="grid grid-cols-2 gap-1">
                <span>現在位置:</span>
                <span className="font-mono text-xs">
                  (
                  {debugSnapshot.movement.drag.currentPosition.x?.toFixed(1) ||
                    0}
                  ,{' '}
                  {debugSnapshot.movement.drag.currentPosition.y?.toFixed(1) ||
                    0}
                  )
                </span>
              </div>
            )}
            {debugSnapshot.movement.drag.currentOffset && (
              <div className="grid grid-cols-2 gap-1">
                <span>現在オフセット:</span>
                <span className="font-mono text-xs">
                  (
                  {debugSnapshot.movement.drag.currentOffset.x?.toFixed(1) || 0}
                  ,{' '}
                  {debugSnapshot.movement.drag.currentOffset.y?.toFixed(1) || 0}
                  )
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1">
              <span>選択オブジェクト数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.movement.drag.selectedObjectIds?.length || 0}
              </span>
            </div>
          </>
        )}

        {/* オブジェクト変換情報 */}
        {debugSnapshot.movement?.objectTransforms && (
          <>
            <div className="text-xs font-medium mt-1 mb-1">
              オブジェクト変換
            </div>
            {debugSnapshot.movement.objectTransforms.lastUpdateTime && (
              <div className="grid grid-cols-2 gap-1">
                <span>最終更新時刻:</span>
                <span className="font-mono text-xs">
                  {new Date(
                    debugSnapshot.movement.objectTransforms.lastUpdateTime,
                  ).toLocaleTimeString()}
                </span>
              </div>
            )}

            {debugSnapshot.movement.objectTransforms.before &&
              Object.keys(debugSnapshot.movement.objectTransforms.before)
                .length > 0 && (
                <div className="space-y-0">
                  <div className="text-xs font-medium mt-1 mb-1">
                    変更前の位置
                  </div>
                  {Object.entries(
                    debugSnapshot.movement.objectTransforms.before,
                  ).map(([id, pos]: [string, any]) => (
                    <div key={id} className="grid grid-cols-2 gap-1">
                      <span className="font-mono text-xs">{id.slice(-6)}:</span>
                      <span className="font-mono text-xs">
                        ({pos.x?.toFixed(1) || 0}, {pos.y?.toFixed(1) || 0})
                      </span>
                    </div>
                  ))}
                </div>
              )}

            {debugSnapshot.movement.objectTransforms.after &&
              Object.keys(debugSnapshot.movement.objectTransforms.after)
                .length > 0 && (
                <div className="space-y-0">
                  <div className="text-xs font-medium mt-1 mb-1">
                    変更後の位置
                  </div>
                  {Object.entries(
                    debugSnapshot.movement.objectTransforms.after,
                  ).map(([id, pos]: [string, any]) => (
                    <div key={id} className="grid grid-cols-2 gap-1">
                      <span className="font-mono text-xs">{id.slice(-6)}:</span>
                      <span className="font-mono text-xs">
                        ({pos.x?.toFixed(1) || 0}, {pos.y?.toFixed(1) || 0})
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </>
        )}

        {/* 実行ログ */}
        {debugSnapshot.movement?.executionLog &&
          debugSnapshot.movement.executionLog.length > 0 && (
            <>
              <div className="text-xs font-medium mt-1 mb-1">
                実行ログ (最新5件)
              </div>
              <div className="space-y-0 max-h-32 overflow-y-auto">
                {debugSnapshot.movement.executionLog
                  .slice(-5)
                  .map((log: any, index: number) => (
                    <div key={index} className="text-xs">
                      <div className="font-mono">
                        [{new Date(log.timestamp).toLocaleTimeString()}]{' '}
                        {log.action}
                      </div>
                      {log.data && (
                        <div className="text-muted-foreground pl-2">
                          {log.data.position &&
                            `位置: (${log.data.position.x?.toFixed(1) || 0}, ${
                              log.data.position.y?.toFixed(1) || 0
                            })`}
                          {log.data.offset &&
                            ` オフセット: (${
                              log.data.offset.x?.toFixed(1) || 0
                            }, ${log.data.offset.y?.toFixed(1) || 0})`}
                          {log.data.error && ` エラー: ${log.data.error}`}
                          {log.data.willExecuteCommand !== undefined &&
                            ` コマンド実行: ${
                              log.data.willExecuteCommand ? 'Yes' : 'No'
                            }`}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </>
          )}

        {/* 移動未実行時 */}
        {!debugSnapshot.movement?.lastMoveCommand?.timestamp && (
          <div className="text-xs text-muted-foreground italic">
            移動コマンド未実行
          </div>
        )}
      </div>
    </div>
  )
})

MovementDebugSection.displayName = 'MovementDebugSection'

// 自動PNG化セクションコンポーネント
const AutoPngSection = memo(({ engine }: { engine: PaplicoEngine | null }) => {
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isEnabled, setIsEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [apiResponse, setApiResponse] = useState<any>(null)
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
      const files = await exporter.export(documentContext, webgpuEngine as any)

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

      // debugState.export.errorsも送信
      if (latestSnapshot.errors && latestSnapshot.errors.length > 0) {
        debugData.debugErrors = [...latestSnapshot.errors]
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
  }, [isEnabled, engine])

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
              className={isEnabled ? 'text-green-600' : 'text-muted-foreground'}
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
})

AutoPngSection.displayName = 'AutoPngSection'

export const DebugPane = memo(({ engine, isOpen }: DebugPaneProps) => {
  // hooksは常に同じ順序で呼び出す必要がある
  const engineState = engine?.state
  const webgpuEngineState = engine?.getEngine()?.state

  const engineSnapshot = useNullishSnapshot(engineState)
  const webgpuEngineSnapshot = useNullishSnapshot(webgpuEngineState)
  const debugSnapshot = useNullishSnapshot(debugState)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('debugPane-activeTab') || 'export'
    }
    return 'engine'
  })

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('debugPane-activeTab', value)
    }
  }

  if (!isOpen) return null

  return (
    <div className="bg-card border-l flex-shrink-0 flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-2 py-1 border-b">
        <div className="flex items-center space-x-1">
          <Bug className="w-3 h-3" />
          <h3 className="text-xs font-medium">デバッグ</h3>
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="h-full flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-6 mx-1 mt-1">
            <TabsTrigger value="engine" className="text-xs">
              エンジン
            </TabsTrigger>
            <TabsTrigger value="debug" className="text-xs">
              デバッグ
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs">
              エクスポート
            </TabsTrigger>
            <TabsTrigger value="movement" className="text-xs">
              移動
            </TabsTrigger>
            <TabsTrigger value="document" className="text-xs">
              ドキュメント
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs">
              システム
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* エンジンタブ */}
            <TabsContent value="engine" className="p-1 text-xs space-y-2 m-0">
              {/* エンジン状態 */}
              <div className="mb-2">
                <div className="font-medium mb-1">エンジン状態</div>
                <div className="border rounded p-1 space-y-0">
                  <div className="grid grid-cols-2 gap-1">
                    <span>FPS:</span>
                    <span className="font-mono text-right">
                      {Math.round(webgpuEngineSnapshot?.performance?.fps || 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>フレーム時間:</span>
                    <span className="font-mono text-right">
                      {webgpuEngineSnapshot?.performance?.frameTime?.toFixed(
                        2,
                      ) || 0}
                      ms
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>ツール:</span>
                    <span className="text-right">
                      {webgpuEngineSnapshot?.tools?.activeTool || 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>描画中:</span>
                    <span className="text-right">
                      {webgpuEngineSnapshot?.tools?.isDrawing ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>キャンバス:</span>
                    <span className="font-mono text-right">
                      {webgpuEngineSnapshot?.canvas?.width || 0}x
                      {webgpuEngineSnapshot?.canvas?.height || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* 選択状態 */}
              <div className="mb-2">
                <div className="font-medium mb-1">選択状態</div>
                <div className="border rounded p-1 space-y-0">
                  <div className="grid grid-cols-2 gap-1">
                    <span>選択オブジェクト数:</span>
                    <span className="font-mono text-right">
                      {debugSnapshot.selection.selectedObjectsCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>選択頂点数:</span>
                    <span className="font-mono text-right">
                      {debugSnapshot.selection.selectedVerticesCount}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>選択モード:</span>
                    <span className="text-right">
                      {debugSnapshot.selection.selectionMode === 'object'
                        ? 'オブジェクト'
                        : '頂点'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>バウンディングボックス:</span>
                    <span className="text-right">
                      {debugSnapshot.selection.boundingBoxAvailable
                        ? 'あり'
                        : 'なし'}
                    </span>
                  </div>
                  {debugSnapshot.selection.boundingBox && (
                    <>
                      <div className="grid grid-cols-2 gap-1">
                        <span>ボックス位置:</span>
                        <span className="font-mono text-xs">
                          ({debugSnapshot.selection.boundingBox.x.toFixed(1)},{' '}
                          {debugSnapshot.selection.boundingBox.y.toFixed(1)})
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span>ボックスサイズ:</span>
                        <span className="font-mono text-xs">
                          {debugSnapshot.selection.boundingBox.width.toFixed(1)}{' '}
                          ×{' '}
                          {debugSnapshot.selection.boundingBox.height.toFixed(
                            1,
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    <span>最終更新:</span>
                    <span className="font-mono text-xs">
                      {debugSnapshot.selection.lastSelectionUpdateTime > 0
                        ? new Date(
                            debugSnapshot.selection.lastSelectionUpdateTime,
                          ).toLocaleTimeString()
                        : 'なし'}
                    </span>
                  </div>
                </div>
              </div>

              {/* カメラ情報 */}
              <div className="mb-2">
                <div className="font-medium mb-1">カメラ情報</div>
                <div className="border rounded p-1 space-y-0">
                  <div className="grid grid-cols-2 gap-1">
                    <span>ズーム:</span>
                    <span className="font-mono text-right">
                      {webgpuEngineSnapshot?.viewport?.zoom?.toFixed(3) || 1}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>位置X:</span>
                    <span className="font-mono text-right">
                      {webgpuEngineSnapshot?.viewport?.x?.toFixed(1) || 0}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>位置Y:</span>
                    <span className="font-mono text-right">
                      {webgpuEngineSnapshot?.viewport?.y?.toFixed(1) || 0}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>回転:</span>
                    <span className="font-mono text-right">
                      {webgpuEngineSnapshot?.viewport?.rotation?.toFixed(2) ||
                        0}
                      °
                    </span>
                  </div>
                </div>
              </div>

              {/* レンダリング統計 */}
              <div className="mb-2">
                <div className="font-medium mb-1">レンダリング統計</div>
                <div className="border rounded p-1 space-y-0">
                  <div className="grid grid-cols-2 gap-1">
                    <span>総ドローコール:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>総三角形:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>総頂点:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>レンダーパス:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>テクスチャ切り替え:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>レンダー時間:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                </div>
              </div>

              {/* WebGPU統計 */}
              <div className="mb-2">
                <div className="font-medium mb-1">WebGPU統計</div>
                <div className="border rounded p-1 space-y-0">
                  <div className="grid grid-cols-2 gap-1">
                    <span>バッファ数:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>テクスチャ数:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>パイプライン数:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>メモリ使用量:</span>
                    <span className="font-mono text-right">N/A</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* デバッグタブ */}
            <TabsContent value="debug" className="p-1 text-xs space-y-2 m-0">
              {/* UI システム診断 */}
              <UIDebugSection />

              {/* ストロークレンダラー診断 */}
              <div className="mb-2">
                <StrokeDebugSection />
              </div>

              {/* ヒットテスト情報 */}
              <div className="mb-2">
                <div className="font-medium mb-1">ヒットテスト情報</div>
                <div className="border rounded p-1 space-y-0">
                  <div className="grid grid-cols-2 gap-1">
                    <span>総テスト回数:</span>
                    <span className="font-mono text-right">
                      {debugSnapshot.hitTest.hitCount}
                    </span>
                  </div>
                  {debugSnapshot.hitTest.lastHitPosition && (
                    <>
                      <div className="grid grid-cols-2 gap-1">
                        <span>最終テスト位置:</span>
                        <span className="font-mono text-right">
                          ({debugSnapshot.hitTest.lastHitPosition.x},{' '}
                          {debugSnapshot.hitTest.lastHitPosition.y})
                        </span>
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    <span>ヒット数:</span>
                    <span className="font-mono text-right">
                      {debugSnapshot.hitTest.lastHitResults?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* ヒット結果詳細 */}
              {(debugSnapshot.hitTest.lastHitResults?.length || 0) > 0 && (
                <div className="mb-2">
                  <div className="font-medium mb-1">ヒット結果詳細</div>
                  <div className="space-y-1">
                    {debugSnapshot.hitTest.lastHitResults?.map(
                      (hit: any, index: number) => (
                        <div
                          key={hit.artObjectId || index}
                          className="border rounded p-1"
                        >
                          <div className="grid grid-cols-2 gap-1 items-center mb-1">
                            <span className="font-medium">
                              {hit.artObjectName ||
                                hit.artObject?.name ||
                                '名前なし'}
                            </span>
                            <span className="text-muted-foreground">
                              距離: {hit.distance?.toFixed(3) || 'N/A'}
                            </span>
                          </div>
                          <div className="space-y-0">
                            <div className="grid grid-cols-2 gap-1">
                              <span>レイヤー:</span>
                              <span className="text-right">
                                {hit.layerName || hit.layerId || 'N/A'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <span>タイプ:</span>
                              <span className="text-right">
                                {hit.artObject?.type || 'N/A'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <span>ワールドX:</span>
                              <span className="font-mono text-right">
                                {hit.worldPosition?.x?.toFixed(1) || 0}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <span>ワールドY:</span>
                              <span className="font-mono text-right">
                                {hit.worldPosition?.y?.toFixed(1) || 0}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <span>ローカルX:</span>
                              <span className="font-mono text-right">
                                {hit.localPosition?.x?.toFixed(1) || 0}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <span>ローカルY:</span>
                              <span className="font-mono text-right">
                                {hit.localPosition?.y?.toFixed(1) || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* エクスポートタブ */}
            <TabsContent value="export" className="p-1 text-xs space-y-2 m-0">
              {/* 自動PNG化 */}
              <AutoPngSection engine={engine} />

              {/* エクスポート診断 */}
              <div className="mb-2">
                <ExportDebugSection />
              </div>
            </TabsContent>

            {/* 移動タブ */}
            <TabsContent value="movement" className="p-1 text-xs space-y-2 m-0">
              {/* 移動システム診断 */}
              <MovementDebugSection />
            </TabsContent>

            {/* ドキュメントタブ */}
            <TabsContent value="document" className="p-1 text-xs space-y-2 m-0">
              {/* ドキュメント情報 */}
              {webgpuEngineSnapshot?.document && (
                <div className="mb-2">
                  <div className="font-medium mb-1">ドキュメント情報</div>
                  <div className="border rounded p-1 space-y-0">
                    <div className="grid grid-cols-2 gap-1">
                      <span>ドキュメントID:</span>
                      <span className="font-mono text-xs">
                        {webgpuEngineSnapshot.document.id?.slice(-8) || 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span>レイヤー数:</span>
                      <span className="font-mono text-right">
                        {
                          Object.keys(
                            webgpuEngineSnapshot.document.layers || {},
                          ).length
                        }
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span>アートオブジェクト数:</span>
                      <span className="font-mono text-right">
                        {
                          Object.keys(
                            webgpuEngineSnapshot.document.artObjects || {},
                          ).length
                        }
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span>アートボード数:</span>
                      <span className="font-mono text-right">
                        {
                          Object.keys(
                            webgpuEngineSnapshot.document.artboards || {},
                          ).length
                        }
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <span>レイヤーノード数:</span>
                      <span className="font-mono text-right">
                        {webgpuEngineSnapshot.document.layerNodes?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* レイヤー詳細 */}
              {webgpuEngineSnapshot?.document?.layers &&
                Object.keys(webgpuEngineSnapshot.document.layers).length >
                  0 && (
                  <div className="mb-2">
                    <div className="font-medium mb-1">レイヤー詳細</div>
                    <div className="space-y-1">
                      {Object.entries(webgpuEngineSnapshot.document.layers).map(
                        ([layerId, layer]: [string, any]) => (
                          <div key={layerId} className="border rounded p-1">
                            <div className="font-medium">
                              {layer.name || layerId.slice(-8)}
                            </div>
                            <div className="space-y-0">
                              <div className="grid grid-cols-2 gap-1">
                                <span>タイプ:</span>
                                <span className="text-right">{layer.type}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                <span>表示:</span>
                                <span className="text-right">
                                  {layer.visible ? 'Yes' : 'No'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                <span>不透明度:</span>
                                <span className="font-mono text-right">
                                  {(layer.opacity || 1).toFixed(2)}
                                </span>
                              </div>
                              {layer.type === 'vector' &&
                                layer.artObjectIds && (
                                  <div className="grid grid-cols-2 gap-1">
                                    <span>オブジェクト数:</span>
                                    <span className="font-mono text-right">
                                      {layer.artObjectIds.length}
                                    </span>
                                  </div>
                                )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* レンダリングされたArtObject詳細 */}
              {webgpuEngineSnapshot?.document?.artObjects &&
                Object.keys(webgpuEngineSnapshot.document.artObjects).length >
                  0 && (
                  <div className="mb-2">
                    <div className="font-medium mb-1">
                      レンダリングArtObject詳細
                    </div>
                    <div className="space-y-1">
                      {Object.entries(
                        webgpuEngineSnapshot.document.artObjects,
                      ).map(([artObjectId, artObject]: [string, any]) => (
                        <details key={artObjectId} className="border rounded">
                          <summary className="p-1 cursor-pointer hover:bg-muted/50">
                            <span className="font-medium">
                              {artObject.name || artObjectId.slice(-8)}
                            </span>
                            <span className="text-muted-foreground ml-1">
                              ({artObject.type})
                            </span>
                          </summary>
                          <div className="p-1 pt-0 space-y-0">
                            <div className="grid grid-cols-2 gap-1">
                              <span>タイプ:</span>
                              <span className="text-right">
                                {artObject.type}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <span>表示:</span>
                              <span className="text-right">
                                {artObject.visible ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <span>レイヤーID:</span>
                              <span className="font-mono text-xs">
                                {artObject.layerId?.slice(-8) || 'N/A'}
                              </span>
                            </div>
                            {artObject.transform && (
                              <>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>座標X:</span>
                                  <span className="font-mono text-right">
                                    {artObject.transform.x?.toFixed(1) || 0}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>座標Y:</span>
                                  <span className="font-mono text-right">
                                    {artObject.transform.y?.toFixed(1) || 0}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>スケールX:</span>
                                  <span className="font-mono text-right">
                                    {artObject.transform.scaleX?.toFixed(3) ||
                                      1}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>スケールY:</span>
                                  <span className="font-mono text-right">
                                    {artObject.transform.scaleY?.toFixed(3) ||
                                      1}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>回転:</span>
                                  <span className="font-mono text-right">
                                    {artObject.transform.rotation?.toFixed(2) ||
                                      0}
                                    °
                                  </span>
                                </div>
                              </>
                            )}
                            {artObject.type === 'canvas' && (
                              <>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>幅:</span>
                                  <span className="font-mono text-right">
                                    {artObject.width || 0}px
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>高さ:</span>
                                  <span className="font-mono text-right">
                                    {artObject.height || 0}px
                                  </span>
                                </div>
                              </>
                            )}
                            {artObject.path && (
                              <>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>パス点数:</span>
                                  <span className="font-mono text-right">
                                    {artObject.path.points?.length || 0}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <span>閉じたパス:</span>
                                  <span className="text-right">
                                    {artObject.path.closed ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </>
                            )}

                            {/* アピアランス詳細 */}
                            {artObject.appearances &&
                              artObject.appearances.length > 0 && (
                                <div className="mt-1">
                                  <div className="font-medium text-xs mb-1">
                                    アピアランス ({artObject.appearances.length}
                                    個)
                                  </div>
                                  <div className="space-y-1">
                                    {artObject.appearances.map(
                                      (appearance: any, appIndex: number) => (
                                        <div
                                          key={appearance.id || appIndex}
                                          className="border border-border/50 rounded p-1"
                                        >
                                          <div className="grid grid-cols-2 gap-1 items-center">
                                            <span className="font-medium text-xs">
                                              {appearance.effectId || 'unknown'}
                                            </span>
                                            <span
                                              className={`text-xs px-1 rounded ${
                                                appearance.enabled
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-red-100 text-red-800'
                                              }`}
                                            >
                                              {appearance.enabled
                                                ? '有効'
                                                : '無効'}
                                            </span>
                                          </div>

                                          {appearance.effectId === 'fill' &&
                                            appearance.params && (
                                              <div className="space-y-0 mt-1">
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>塗り色:</span>
                                                  <div className="flex items-center gap-1">
                                                    <div
                                                      className="w-3 h-3 border border-border rounded"
                                                      style={{
                                                        backgroundColor: `rgba(${Math.round(
                                                          (appearance.params
                                                            .color?.r || 0) *
                                                            255,
                                                        )}, ${Math.round(
                                                          (appearance.params
                                                            .color?.g || 0) *
                                                            255,
                                                        )}, ${Math.round(
                                                          (appearance.params
                                                            .color?.b || 0) *
                                                            255,
                                                        )}, ${
                                                          appearance.params
                                                            .color?.a || 1
                                                        })`,
                                                      }}
                                                    />
                                                    <span className="font-mono text-xs">
                                                      rgba(
                                                      {Math.round(
                                                        (appearance.params.color
                                                          ?.r || 0) * 255,
                                                      )}
                                                      ,{' '}
                                                      {Math.round(
                                                        (appearance.params.color
                                                          ?.g || 0) * 255,
                                                      )}
                                                      ,{' '}
                                                      {Math.round(
                                                        (appearance.params.color
                                                          ?.b || 0) * 255,
                                                      )}
                                                      ,{' '}
                                                      {(
                                                        appearance.params.color
                                                          ?.a || 1
                                                      ).toFixed(2)}
                                                      )
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>塗り不透明度:</span>
                                                  <span className="font-mono text-right">
                                                    {(
                                                      appearance.params
                                                        .opacity || 1
                                                    ).toFixed(2)}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>塗りルール:</span>
                                                  <span className="text-right">
                                                    {appearance.params
                                                      .fillRule || 'nonzero'}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>ブレンドモード:</span>
                                                  <span className="text-right">
                                                    {appearance.params
                                                      .blendMode || 'normal'}
                                                  </span>
                                                </div>
                                              </div>
                                            )}

                                          {appearance.effectId === 'stroke' &&
                                            appearance.params && (
                                              <div className="space-y-0 mt-1">
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>線色:</span>
                                                  <div className="flex items-center gap-1">
                                                    <div
                                                      className="w-3 h-3 border border-border rounded"
                                                      style={{
                                                        backgroundColor: `rgba(${Math.round(
                                                          (appearance.params
                                                            .color?.r || 0) *
                                                            255,
                                                        )}, ${Math.round(
                                                          (appearance.params
                                                            .color?.g || 0) *
                                                            255,
                                                        )}, ${Math.round(
                                                          (appearance.params
                                                            .color?.b || 0) *
                                                            255,
                                                        )}, ${
                                                          appearance.params
                                                            .color?.a || 1
                                                        })`,
                                                      }}
                                                    />
                                                    <span className="font-mono text-xs">
                                                      rgba(
                                                      {Math.round(
                                                        (appearance.params.color
                                                          ?.r || 0) * 255,
                                                      )}
                                                      ,{' '}
                                                      {Math.round(
                                                        (appearance.params.color
                                                          ?.g || 0) * 255,
                                                      )}
                                                      ,{' '}
                                                      {Math.round(
                                                        (appearance.params.color
                                                          ?.b || 0) * 255,
                                                      )}
                                                      ,{' '}
                                                      {(
                                                        appearance.params.color
                                                          ?.a || 1
                                                      ).toFixed(2)}
                                                      )
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>線幅:</span>
                                                  <span className="font-mono text-right">
                                                    {appearance.params.width ||
                                                      1}
                                                    px
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>線不透明度:</span>
                                                  <span className="font-mono text-right">
                                                    {(
                                                      appearance.params
                                                        .opacity || 1
                                                    ).toFixed(2)}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>線スタイル:</span>
                                                  <span className="text-right">
                                                    {appearance.params.style ||
                                                      'solid'}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>線キャップ:</span>
                                                  <span className="text-right">
                                                    {appearance.params
                                                      .lineCap || 'round'}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>線ジョイン:</span>
                                                  <span className="text-right">
                                                    {appearance.params
                                                      .lineJoin || 'round'}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                  <span>ブレンドモード:</span>
                                                  <span className="text-right">
                                                    {appearance.params
                                                      .blendMode || 'normal'}
                                                  </span>
                                                </div>
                                                {appearance.params
                                                  .brushSettings && (
                                                  <>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <span>
                                                        ブラシテクスチャ:
                                                      </span>
                                                      <span className="text-right">
                                                        {appearance.params
                                                          .brushSettings
                                                          .texture || 'none'}
                                                      </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <span>スキャッター:</span>
                                                      <span className="font-mono text-right">
                                                        {(
                                                          appearance.params
                                                            .brushSettings
                                                            .scatterRange || 0
                                                        ).toFixed(2)}
                                                      </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <span>回転調整:</span>
                                                      <span className="font-mono text-right">
                                                        {(
                                                          appearance.params
                                                            .brushSettings
                                                            .rotationAdjust || 1
                                                        ).toFixed(2)}
                                                      </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <span>ランダム回転:</span>
                                                      <span className="font-mono text-right">
                                                        {(
                                                          appearance.params
                                                            .brushSettings
                                                            .randomRotation || 0
                                                        ).toFixed(2)}
                                                      </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <span>
                                                        ランダムスケール:
                                                      </span>
                                                      <span className="font-mono text-right">
                                                        {(
                                                          appearance.params
                                                            .brushSettings
                                                            .randomScale || 0
                                                        ).toFixed(2)}
                                                      </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <span>筆圧影響:</span>
                                                      <span className="font-mono text-right">
                                                        {(
                                                          appearance.params
                                                            .brushSettings
                                                            .pressureInfluence ||
                                                          0
                                                        ).toFixed(2)}
                                                      </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <span>ノイズ影響:</span>
                                                      <span className="font-mono text-right">
                                                        {(
                                                          appearance.params
                                                            .brushSettings
                                                            .noiseInfluence || 0
                                                        ).toFixed(2)}
                                                      </span>
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            )}

                                          {!['fill', 'stroke'].includes(
                                            appearance.effectId,
                                          ) && (
                                            <div className="space-y-0 mt-1">
                                              <div className="grid grid-cols-2 gap-1">
                                                <span>パラメータ:</span>
                                                <span className="font-mono text-xs">
                                                  {JSON.stringify(
                                                    appearance.params || {},
                                                  ).slice(0, 50)}
                                                  ...
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                            {(!artObject.appearances ||
                              artObject.appearances.length === 0) && (
                              <div className="text-muted-foreground text-xs italic mt-1">
                                アピアランスなし
                              </div>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
            </TabsContent>

            {/* システムタブ */}
            <TabsContent value="system" className="p-1 text-xs space-y-2 m-0">
              {/* メモリ情報 */}
              <div className="mb-2">
                <div className="font-medium mb-1">メモリ情報</div>
                <div className="border rounded p-1 space-y-0">
                  <div className="grid grid-cols-2 gap-1">
                    <span>JSヒープサイズ:</span>
                    <span className="font-mono text-right">
                      {(
                        (performance as any).memory?.usedJSHeapSize /
                        1024 /
                        1024
                      )?.toFixed(1) || 'N/A'}
                      MB
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>JSヒープ制限:</span>
                    <span className="font-mono text-right">
                      {(
                        (performance as any).memory?.jsHeapSizeLimit /
                        1024 /
                        1024
                      )?.toFixed(1) || 'N/A'}
                      MB
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <span>総JSヒープ:</span>
                    <span className="font-mono text-right">
                      {(
                        (performance as any).memory?.totalJSHeapSize /
                        1024 /
                        1024
                      )?.toFixed(1) || 'N/A'}
                      MB
                    </span>
                  </div>
                </div>
              </div>

              {/* デバッグ情報がない場合 */}
              {!webgpuEngineSnapshot && (
                <div className="text-center text-muted-foreground p-2">
                  エンジンが初期化されていません
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
})

DebugPane.displayName = 'DebugPane'

'use client'

import { Check, Copy } from 'lucide-react'
import { memo, useState } from 'react'
import { useSnapshot } from 'valtio'
import { Button } from '@/components/ui/button'
import { debugState } from '../../../../engine/webgpu/core-engine'

export const StrokeDebugSection = memo(() => {
  const strokeDebug = useSnapshot(debugState.stroke)
  const [isCopied, setIsCopied] = useState(false)

  const copyDebugInfo = async () => {
    const debugInfo = `ストロークレンダリング状態:
初期化: ${strokeDebug.renderer.initialized ? 'OK' : 'NG'}
GPU利用可能: ${strokeDebug.renderer.isGPUComputeAvailable ? 'OK' : 'NG'}
レンダー回数: ${strokeDebug.rendering.callCount}
成功回数: ${strokeDebug.rendering.successCount}
失敗回数: ${strokeDebug.rendering.failureCount}
最終パス点数: ${strokeDebug.rendering.lastPathPointCount}
インスタンス数: ${strokeDebug.rendering.lastInstanceCount}
ストロークレイヤー: ${strokeDebug.document.strokeLayerCount}
ストロークオブジェクト: ${strokeDebug.document.strokeArtObjectCount}
webgpu-utils解析: ${strokeDebug.webgpuUtils.lastParseError ? 'エラー' : 'OK'}
uniform構造体: ${strokeDebug.webgpuUtils.uniformsAvailable.join(', ') || 'なし'}
struct定義: ${strokeDebug.webgpuUtils.structsAvailable.join(', ') || 'なし'}
webgpu-utilsエラー: ${strokeDebug.webgpuUtils.lastParseError || 'なし'}
最終エラー: ${
      strokeDebug.renderer.lastInitError ||
      strokeDebug.rendering.lastError ||
      'なし'
    }
エラー発生場所: ${strokeDebug.rendering.lastErrorLocation || 'なし'}
エラースタック: ${
      strokeDebug.rendering.lastErrorStack
        ? strokeDebug.rendering.lastErrorStack.split('\n')[0]
        : 'なし'
    }`

    try {
      await navigator.clipboard.writeText(debugInfo)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('コピーに失敗:', error)
    }
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">ストロークレンダリング</span>
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
      <div className="border rounded p-1 space-y-0">
        {/* レンダラー状態 */}
        <div className="grid grid-cols-2 gap-1">
          <span>初期化:</span>
          <span className="text-right">
            {strokeDebug.renderer.initialized ? 'OK' : 'NG'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>GPU利用可能:</span>
          <span className="text-right">
            {strokeDebug.renderer.isGPUComputeAvailable ? 'OK' : 'NG'}
          </span>
        </div>

        {/* レンダリング状況 */}
        <div className="grid grid-cols-2 gap-1">
          <span>レンダー回数:</span>
          <span className="font-mono text-right">
            {strokeDebug.rendering.callCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>成功/失敗:</span>
          <span className="font-mono text-right">
            {strokeDebug.rendering.successCount}/
            {strokeDebug.rendering.failureCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>最終パス点数:</span>
          <span className="font-mono text-right">
            {strokeDebug.rendering.lastPathPointCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>インスタンス数:</span>
          <span className="font-mono text-right">
            {strokeDebug.rendering.lastInstanceCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>計算時間:</span>
          <span className="font-mono text-right">
            {strokeDebug.rendering.computeDuration.toFixed(2)}ms
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>描画時間:</span>
          <span className="font-mono text-right">
            {strokeDebug.rendering.renderDuration.toFixed(2)}ms
          </span>
        </div>

        {/* webgpu-utils状況 */}
        <div className="grid grid-cols-2 gap-1">
          <span>webgpu-utils解析:</span>
          <span className="text-right">
            {strokeDebug.webgpuUtils.lastParseError ? 'エラー' : 'OK'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>uniform構造体:</span>
          <span className="font-mono text-right">
            {strokeDebug.webgpuUtils.uniformsAvailable.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>struct定義:</span>
          <span className="font-mono text-right">
            {strokeDebug.webgpuUtils.structsAvailable.length}
          </span>
        </div>

        {/* ドキュメント状況 */}
        <div className="grid grid-cols-2 gap-1">
          <span>ストロークレイヤー:</span>
          <span className="font-mono text-right">
            {strokeDebug.document.strokeLayerCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>ストロークオブジェクト:</span>
          <span className="font-mono text-right">
            {strokeDebug.document.strokeArtObjectCount}
          </span>
        </div>

        {/* インスタンスバッファ状況 */}
        <div className="grid grid-cols-2 gap-1">
          <span>最大インスタンス:</span>
          <span className="font-mono text-right">
            {strokeDebug.instanceBuffer.maxInstances}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>要求/実際:</span>
          <span className="font-mono text-right">
            {strokeDebug.instanceBuffer.requestedInstances}/
            {strokeDebug.instanceBuffer.actualInstances}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>オーバーフロー:</span>
          <span className="text-right">
            {strokeDebug.instanceBuffer.overflow ? (
              <span className="text-red-600">発生</span>
            ) : (
              'なし'
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>基本間隔:</span>
          <span className="font-mono text-right">
            {strokeDebug.instanceBuffer.baseSpacing.toFixed(3)}
          </span>
        </div>

        {/* エラー表示 */}
        {strokeDebug.renderer.lastInitError && (
          <div className="col-span-2 text-red-600 text-xs">
            初期化エラー: {strokeDebug.renderer.lastInitError}
          </div>
        )}
        {strokeDebug.webgpuUtils.lastParseError && (
          <div className="col-span-2 text-red-600 text-xs">
            webgpu-utilsエラー: {strokeDebug.webgpuUtils.lastParseError}
          </div>
        )}
        {strokeDebug.webgpuUtils.uniformsAvailable.length > 0 && (
          <div className="col-span-2 text-green-600 text-xs">
            uniform構造体:{' '}
            {strokeDebug.webgpuUtils.uniformsAvailable.join(', ')}
          </div>
        )}
        {strokeDebug.webgpuUtils.structsAvailable.length > 0 && (
          <div className="col-span-2 text-blue-600 text-xs">
            struct定義: {strokeDebug.webgpuUtils.structsAvailable.join(', ')}
          </div>
        )}
        {strokeDebug.rendering.lastError && (
          <>
            <div className="col-span-2 text-red-600 text-xs">
              レンダリングエラー: {strokeDebug.rendering.lastError}
            </div>
            {strokeDebug.rendering.lastErrorLocation && (
              <div className="col-span-2 text-red-600 text-xs">
                発生場所: {strokeDebug.rendering.lastErrorLocation}
              </div>
            )}
            {strokeDebug.rendering.lastErrorStack && (
              <div className="col-span-2 text-red-600 text-xs font-mono">
                {strokeDebug.rendering.lastErrorStack.split('\n')[0]}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})

StrokeDebugSection.displayName = 'StrokeDebugSection'

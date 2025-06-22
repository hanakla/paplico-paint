'use client'

import { memo } from 'react'
import { debugState } from '@/engine/webgpu/core-engine'
import { useNullishSnapshot } from '@/lib/hooks'

export const UIDebugSection = memo(() => {
  const debugSnapshot = useNullishSnapshot(debugState)

  if (!debugSnapshot) {
    return (
      <div className="text-xs text-muted-foreground">
        Debug state loading...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* 診断結果 */}
      <div className="space-y-1">
        <div className="font-medium text-xs mb-1">UI システム診断</div>
        {/* エラー */}
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
            アクティブコンポーネント ({debugSnapshot.ui.activeComponents.length}
            件)
          </div>
          <div className="space-y-0 max-h-20 overflow-y-auto">
            {debugSnapshot.ui.activeComponents.map(
              (component: string, index: number) => (
                <div key={index} className="text-xs font-mono">
                  {component}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* 描画順序 */}
      {debugSnapshot.ui.drawOrder.length > 0 && (
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">描画順序 (最新5件)</div>
          <div className="space-y-0 max-h-24 overflow-y-auto">
            {debugSnapshot.ui.drawOrder
              .slice(-5)
              .map((order: any, index: number) => (
                <div key={index} className="text-xs font-mono">
                  {order.type}
                  {order.elementId && ` #${order.elementId.slice(-6)}`}
                  {order.zIndex !== undefined && ` z:${order.zIndex}`}
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
  )
})

UIDebugSection.displayName = 'UIDebugSection'

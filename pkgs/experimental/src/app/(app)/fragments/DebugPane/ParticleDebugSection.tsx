'use client'

import { memo } from 'react'
import { useSnapshot } from 'valtio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { debugState } from '@/engine/webgpu/core-engine'

export const ParticleDebugSection = memo(() => {
  const debugSnapshot = useSnapshot(debugState)
  const particleDebug = debugSnapshot.stroke.particleDebug

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">🔍 パーティクル問題デバッグ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 現在の状態 */}
        <div>
          <h4 className="text-xs font-medium mb-1">現在の状態</h4>
          <div className="text-xs space-y-1">
            <div>
              最新レンダリング:{' '}
              {new Date(
                particleDebug.lastRenderCall.timestamp,
              ).toLocaleTimeString()}
            </div>
            <div>
              現在のストローク:{' '}
              {particleDebug.lastRenderCall.hasCurrentStroke ? '有り' : '無し'}
            </div>
            <div>
              ストロークポイント数:{' '}
              {particleDebug.lastRenderCall.currentStrokePointCount}
            </div>
          </div>
        </div>

        {/* インスタンス情報 */}
        <div>
          <h4 className="text-xs font-medium mb-1">インスタンス情報</h4>
          <div className="text-xs space-y-1">
            <div>
              計算されたインスタンス数:{' '}
              {particleDebug.lastRenderCall.instanceCount}
            </div>
            <div>
              実際に描画されたインスタンス数:{' '}
              {particleDebug.lastRenderCall.actualDrawnInstances}
            </div>
            <div>
              バッファクリア済み:{' '}
              {particleDebug.lastRenderCall.bufferCleared ? '✅' : '❌'}
            </div>
          </div>
        </div>

        {/* レンダリング統計 */}
        <div>
          <h4 className="text-xs font-medium mb-1">レンダリング統計</h4>
          <div className="text-xs space-y-1">
            <div>
              総レンダリング呼び出し:{' '}
              {particleDebug.renderingStats.totalRenderCalls}
            </div>
            <div>
              空のレンダリング呼び出し:{' '}
              {particleDebug.renderingStats.emptyRenderCalls}
            </div>
            <div>
              最後の空レンダリング理由:{' '}
              {particleDebug.renderingStats.lastEmptyRenderReason || 'なし'}
            </div>
          </div>
        </div>

        {/* 診断結果 */}
        <div>
          <h4 className="text-xs font-medium mb-1">🚨 問題診断</h4>
          <div className="text-xs space-y-1">
            {particleDebug.lastRenderCall.instanceCount > 0 &&
              !particleDebug.lastRenderCall.hasCurrentStroke && (
                <div className="text-red-600">
                  ⚠️ ストロークがないのにインスタンスが生成されている
                </div>
              )}
            {particleDebug.lastRenderCall.actualDrawnInstances > 0 &&
              !particleDebug.lastRenderCall.hasCurrentStroke && (
                <div className="text-red-600">
                  ⚠️ ストロークがないのにインスタンスが描画されている
                </div>
              )}
            {!particleDebug.lastRenderCall.bufferCleared && (
              <div className="text-yellow-600">
                ⚠️ バッファがクリアされていない
              </div>
            )}
            {particleDebug.renderingStats.emptyRenderCalls === 0 && (
              <div className="text-green-600">
                ✅ 空のレンダリング呼び出しなし
              </div>
            )}
          </div>
        </div>

        {/* リアルタイム更新表示 */}
        <div className="text-xs text-gray-500">
          最終更新: {new Date().toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
})

ParticleDebugSection.displayName = 'ParticleDebugSection'

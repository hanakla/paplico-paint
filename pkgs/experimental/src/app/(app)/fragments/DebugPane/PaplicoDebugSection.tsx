'use client'

import { memo } from 'react'
import type { PaplicoEngine } from '@/engine/paplico'
import { debugState } from '@/engine/webgpu/core-engine'
import { useNullishSnapshot } from '@/lib/hooks'

interface PaplicoDebugSectionProps {
  engine: PaplicoEngine | null
}

export const PaplicoDebugSection = memo(
  ({ engine }: PaplicoDebugSectionProps) => {
    const debugSnapshot = useNullishSnapshot(debugState)

    if (!debugSnapshot || !engine) {
      return (
        <div className="text-xs text-muted-foreground">
          Paplico debug data loading...
        </div>
      )
    }

    const paplicoDebug = debugSnapshot.paplicoEngine

    return (
      <div className="space-y-2">
        {/* レンダー最適化情報 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">レンダー最適化</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>レンダー必要:</span>
            <span
              className={`font-mono text-right ${paplicoDebug.renderOptimization.needsRender ? 'text-orange-600' : 'text-green-600'}`}
            >
              {paplicoDebug.renderOptimization.needsRender ? '要求中' : '不要'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>最終レンダー時間:</span>
            <span className="font-mono text-right">
              {paplicoDebug.renderOptimization.lastRenderTime.toFixed(2)}ms
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>レンダー間隔:</span>
            <span className="font-mono text-right">
              {paplicoDebug.renderOptimization.renderCheckInterval}ms
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>スキップフレーム:</span>
            <span className="font-mono text-right">
              {paplicoDebug.renderOptimization.frameSkipped} /{' '}
              {paplicoDebug.renderOptimization.totalFrames}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>レンダー要求数:</span>
            <span className="font-mono text-right">
              {paplicoDebug.renderOptimization.renderRequestCount}
            </span>
          </div>
          {paplicoDebug.renderOptimization.lastRenderReason && (
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>最終要求理由:</span>
              <span className="font-mono text-right text-xs">
                {paplicoDebug.renderOptimization.lastRenderReason}
              </span>
            </div>
          )}
        </div>

        {/* 入力システム情報 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">入力システム</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>現在のツール:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.currentTool || 'なし'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>マウス状態:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.isMouseDown ? '押下中' : '非押下'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>パン状態:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.isPanning ? '実行中' : '停止'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>ズーム状態:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.isZooming ? '実行中' : '停止'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>ポインタ数:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.pointerCount}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>最終イベント:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.lastEventTimestamp > 0
                ? `${Date.now() - paplicoDebug.input.lastEventTimestamp}ms前`
                : 'なし'}
            </span>
          </div>
        </div>

        {/* イベント統計 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">イベント統計</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>pointerDown:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.eventCount.pointerDown}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>pointerMove:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.eventCount.pointerMove}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>pointerUp:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.eventCount.pointerUp}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>wheel:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.eventCount.wheel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>touch:</span>
            <span className="font-mono text-right">
              {paplicoDebug.input.eventCount.touch}
            </span>
          </div>
        </div>

        {/* カメラ情報 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">カメラ詳細</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>位置:</span>
            <span className="font-mono text-right">
              ({paplicoDebug.camera.position.x.toFixed(1)},{' '}
              {paplicoDebug.camera.position.y.toFixed(1)})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>ズーム:</span>
            <span className="font-mono text-right">
              {(paplicoDebug.camera.zoom * 100).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>回転:</span>
            <span className="font-mono text-right">
              {paplicoDebug.camera.rotation.toFixed(1)}°
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>ビューポート:</span>
            <span className="font-mono text-right">
              {paplicoDebug.camera.viewport.width}x
              {paplicoDebug.camera.viewport.height}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>変形回数:</span>
            <span className="font-mono text-right">
              {paplicoDebug.camera.transformationCount}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>最終変形:</span>
            <span className="font-mono text-right">
              {paplicoDebug.camera.lastTransformTimestamp > 0
                ? `${Date.now() - paplicoDebug.camera.lastTransformTimestamp}ms前`
                : 'なし'}
            </span>
          </div>
        </div>

        {/* ドキュメント情報 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">ドキュメント詳細</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>アクティブID:</span>
            <span className="font-mono text-right">
              {paplicoDebug.document.activeDocumentId?.slice(-8) || 'なし'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>レイヤー数:</span>
            <span className="font-mono text-right">
              {paplicoDebug.document.layerCount}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>アートオブジェクト数:</span>
            <span className="font-mono text-right">
              {paplicoDebug.document.artObjectCount}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>アートボード数:</span>
            <span className="font-mono text-right">
              {paplicoDebug.document.artboardCount}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>変更回数:</span>
            <span className="font-mono text-right">
              {paplicoDebug.document.documentChanges}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>最終変更:</span>
            <span className="font-mono text-right">
              {paplicoDebug.document.lastModified > 0
                ? `${Date.now() - paplicoDebug.document.lastModified}ms前`
                : 'なし'}
            </span>
          </div>
        </div>

        {/* パフォーマンス情報 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">パフォーマンス</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>初期化時間:</span>
            <span className="font-mono text-right">
              {paplicoDebug.performance.initializationTime.toFixed(2)}ms
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>総レンダー時間:</span>
            <span className="font-mono text-right">
              {paplicoDebug.performance.totalRenderTime.toFixed(2)}ms
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>平均フレーム時間:</span>
            <span className="font-mono text-right">
              {paplicoDebug.performance.averageFrameTime.toFixed(2)}ms
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>メモリ使用量:</span>
            <span className="font-mono text-right">
              {(
                paplicoDebug.performance.memoryUsage.used /
                1024 /
                1024
              ).toFixed(1)}
              MB
            </span>
          </div>
        </div>
      </div>
    )
  },
)

PaplicoDebugSection.displayName = 'PaplicoDebugSection'

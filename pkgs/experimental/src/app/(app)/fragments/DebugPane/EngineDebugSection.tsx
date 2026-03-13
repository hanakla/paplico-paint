'use client';

import { memo } from 'react';
import type { PaplicoEngine } from '@/engine/paplico';
import { debugState } from '@/engine/webgpu/core-engine';
import { useNullishSnapshot } from '@/lib/hooks';

interface EngineDebugSectionProps {
  engine: PaplicoEngine | null;
}

export const EngineDebugSection = memo(
  ({ engine }: EngineDebugSectionProps) => {
    const debugSnapshot = useNullishSnapshot(debugState);

    if (!debugSnapshot || !engine) {
      return (
        <div className="text-xs text-muted-foreground">
          Engine debug data loading...
        </div>
      );
    }

    const engineState = engine.getEngineState();
    const paplicoState = engine.getState();

    return (
      <div className="space-y-2">
        {/* エンジン状態 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">エンジン状態</div>
          {/* <div className="grid grid-cols-2 gap-1 text-xs">
            <span>アクティブツール:</span>
            <span className="font-mono text-right">
              {engineState.tools.activeTool}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>描画中:</span>
            <span className="font-mono text-right">
              {engineState.tools.isDrawing ? '✅' : '❌'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>現在のストローク:</span>
            <span className="font-mono text-right">
              {engineState.tools.currentStroke?.points?.length || 0} points
            </span>
          </div> */}
        </div>

        {/* カメラ状態 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">カメラ状態</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>位置:</span>
            <span className="font-mono text-right">
              ({paplicoState.camera.x.toFixed(1)},{' '}
              {paplicoState.camera.y.toFixed(1)})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>ズーム:</span>
            <span className="font-mono text-right">
              {(paplicoState.camera.zoom * 100).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>回転:</span>
            <span className="font-mono text-right">
              {paplicoState.camera.rotation.toFixed(1)}°
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>ビューポート:</span>
            <span className="font-mono text-right">
              {paplicoState.viewport.width}x{paplicoState.viewport.height}
            </span>
          </div>
        </div>

        {/* ブラシ設定 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">ブラシ設定</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>サイズ:</span>
            <span className="font-mono text-right">
              {engineState.strokeSettings.width}px
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>不透明度:</span>
            <span className="font-mono text-right">
              {(engineState.strokeSettings.opacity * 100).toFixed(0)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>色:</span>
            <span className="font-mono text-right">
              RGBA({Math.round(engineState.strokeSettings.color.r * 255)},{' '}
              {Math.round(engineState.strokeSettings.color.g * 255)},{' '}
              {Math.round(engineState.strokeSettings.color.b * 255)},{' '}
              {engineState.strokeSettings.color.a.toFixed(2)})
            </span>
          </div>
        </div>

        {/* ドキュメント状態 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">ドキュメント状態</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>アクティブドキュメント:</span>
            <span className="font-mono text-right">
              {paplicoState.activeDocumentId
                ? paplicoState.activeDocumentId.slice(-8)
                : 'なし'}
            </span>
          </div>
          {engineState.document && (
            <>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span>レイヤー数:</span>
                <span className="font-mono text-right">
                  {Object.keys(engineState.document.layers).length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span>アートオブジェクト数:</span>
                <span className="font-mono text-right">
                  {Object.keys(engineState.document.artObjects).length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span>アートボード数:</span>
                <span className="font-mono text-right">
                  {Object.keys(engineState.document.artboards).length}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 配置ガイド */}
        {paplicoState.alignment.objects.length > 0 && (
          <div className="space-y-0">
            <div className="font-medium text-xs mb-1">配置ガイド</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>オブジェクト数:</span>
              <span className="font-mono text-right">
                {paplicoState.alignment.objects.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>垂直ガイド数:</span>
              <span className="font-mono text-right">
                {paplicoState.alignment.vertical.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>水平ガイド数:</span>
              <span className="font-mono text-right">
                {paplicoState.alignment.horizontal.length}
              </span>
            </div>
          </div>
        )}

        {/* WebGPU情報 */}
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">WebGPU情報</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>デバイス状態:</span>
            <span className="font-mono text-right text-green-600">
              初期化済み
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>キャプチャフレーム:</span>
            <span className="font-mono text-right">
              {debugSnapshot.capturedFrame ? '有効' : '無効'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>統計表示:</span>
            <span className="font-mono text-right">
              {debugSnapshot.showStats ? '有効' : '無効'}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

EngineDebugSection.displayName = 'EngineDebugSection';

'use client';

import { memo } from 'react';
import { debugState } from '@/engine/webgpu/core-engine';
import { useNullishSnapshot } from '@/lib/hooks';

export const HitTestDebugSection = memo(() => {
  const debugSnapshot = useNullishSnapshot(debugState);

  if (!debugSnapshot) {
    return (
      <div className="text-xs text-muted-foreground">
        Hit test debug data loading...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ヒットテスト統計 */}
      <div className="space-y-0">
        <div className="font-medium text-xs mb-1">ヒットテスト統計</div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <span>総ヒットテスト数:</span>
          <span className="font-mono text-right">
            {debugSnapshot.hitTest.hitCount}
          </span>
        </div>
        {debugSnapshot.hitTest.lastHitPosition && (
          <>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>最後のヒット位置:</span>
              <span className="font-mono text-right">
                ({debugSnapshot.hitTest.lastHitPosition.x.toFixed(1)},{' '}
                {debugSnapshot.hitTest.lastHitPosition.y.toFixed(1)})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>最後のヒット結果数:</span>
              <span className="font-mono text-right">
                {debugSnapshot.hitTest.lastHitResults.length}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 最新のヒットテスト結果 */}
      {debugSnapshot.hitTest.lastHitResults.length > 0 && (
        <div className="space-y-0">
          <div className="font-medium text-xs mb-1">
            最新のヒットテスト結果 (最大5件)
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {debugSnapshot.hitTest.lastHitResults
              .slice(0, 5)
              .map((result: any, index: number) => (
                <div key={index} className="border rounded p-1 text-xs">
                  <div className="grid grid-cols-2 gap-1">
                    <span>オブジェクトID:</span>
                    <span className="font-mono text-right">
                      {result.artObject?.id?.slice(-8) || 'unknown'}
                    </span>
                  </div>
                  {result.distance !== undefined && (
                    <div className="grid grid-cols-2 gap-1">
                      <span>距離:</span>
                      <span className="font-mono text-right">
                        {result.distance.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {result.boundingBox && (
                    <div className="grid grid-cols-2 gap-1">
                      <span>バウンディングボックス:</span>
                      <span className="font-mono text-right text-xs">
                        {result.boundingBox.x.toFixed(0)},
                        {result.boundingBox.y.toFixed(0)}{' '}
                        {result.boundingBox.width.toFixed(0)}x
                        {result.boundingBox.height.toFixed(0)}
                      </span>
                    </div>
                  )}
                  {result.artObject?.type && (
                    <div className="grid grid-cols-2 gap-1">
                      <span>タイプ:</span>
                      <span className="font-mono text-right">
                        {result.artObject.type}
                      </span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ヒットテストが実行されていない場合 */}
      {debugSnapshot.hitTest.hitCount === 0 && (
        <div className="text-xs text-muted-foreground italic">
          まだヒットテストが実行されていません。
          オブジェクトをクリックしてみてください。
        </div>
      )}

      {/* ヒットテストの説明 */}
      <div className="space-y-0 pt-2 border-t">
        <div className="font-medium text-xs mb-1">ヒットテストについて</div>
        <div className="text-xs text-muted-foreground">
          ヒットテストは、マウスクリックやタッチ操作でオブジェクトが選択される際に使用されます。
          座標変換、バウンディングボックス計算、レイキャスト処理の精度をここで確認できます。
        </div>
      </div>
    </div>
  );
});

HitTestDebugSection.displayName = 'HitTestDebugSection';

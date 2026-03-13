'use client';

import { useEventCallback } from '@paplico/shared-lib/react';
import { Bug } from 'lucide-react';
import { memo, useEffect } from 'react';
import { snapshot } from 'valtio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PaplicoEngine } from '@/engine/paplico';
import { debugState } from '@/engine/webgpu/core-engine';
import { saveDebugData } from '@/lib/debug-helpers';
import { DocumentStateSection } from './DebugPane/DocumentStateSection';
import { EngineDebugSection } from './DebugPane/EngineDebugSection';
import { AutoPngSection } from './DebugPane/Exports';
import { HistoryDebugSection } from './DebugPane/HistoryDebugSection';
import { HitTestDebugSection } from './DebugPane/HitTestDebugSection';
import { PaplicoDebugSection } from './DebugPane/PaplicoDebugSection';
import { StrokeDebugSection } from './DebugPane/StrokeDebugSection';
import { UIDebugSection } from './DebugPane/UIDebugSection';

interface DebugPaneProps {
  engine: PaplicoEngine | null;
  isOpen: boolean;
}

export const DebugPane = memo(({ engine: paplico, isOpen }: DebugPaneProps) => {
  const submitDebugData = useEventCallback(async () => {
    const debugStateSnap = snapshot(debugState);
    try {
      if (!debugStateSnap) return;

      // stroke関連のデバッグ情報を抽出
      const strokeDebugData: any = {};

      if (debugStateSnap.stroke?.pipelineError) {
        strokeDebugData.pipelineError = debugStateSnap.stroke.pipelineError;
      }

      if (debugStateSnap.stroke?.texturePixelAnalysis) {
        strokeDebugData.texturePixelAnalysis =
          debugStateSnap.stroke.texturePixelAnalysis;
      }

      if (debugStateSnap.stroke?.textureCoordinates) {
        strokeDebugData.textureCoordinates =
          debugStateSnap.stroke.textureCoordinates;
      }

      if (debugStateSnap.stroke?.strokeSaveData) {
        strokeDebugData.strokeSaveData = debugStateSnap.stroke.strokeSaveData;
      }

      if (debugStateSnap.stroke?.commandExecution) {
        strokeDebugData.commandExecution =
          debugStateSnap.stroke.commandExecution;
      }

      if (debugStateSnap.stroke?.documentChanges) {
        strokeDebugData.documentChanges = debugStateSnap.stroke.documentChanges;
      }

      if (debugStateSnap.stroke?.rendering?.perStrokeData) {
        strokeDebugData.perStrokeData =
          debugStateSnap.stroke.rendering.perStrokeData;
      }

      if (debugStateSnap.stroke?.rendering?.frameStats) {
        strokeDebugData.frameStats = debugStateSnap.stroke.rendering.frameStats;
      }

      // UI関連のデバッグデータ
      const uiDebugData: any = {};

      if (debugStateSnap.ui?.backgroundDebugData) {
        uiDebugData.backgroundDebugData = debugStateSnap.ui.backgroundDebugData;
      }

      if (debugStateSnap.ui?.backgroundSuccessData) {
        uiDebugData.backgroundSuccessData =
          debugStateSnap.ui.backgroundSuccessData;
      }

      if (debugStateSnap.ui?.documentStateData) {
        uiDebugData.documentStateData = debugStateSnap.ui.documentStateData;
      }

      if (debugStateSnap.ui?.foregroundDebugData) {
        uiDebugData.foregroundDebugData = debugStateSnap.ui.foregroundDebugData;
      }

      if (debugStateSnap.ui?.foregroundSuccessData) {
        uiDebugData.foregroundSuccessData =
          debugStateSnap.ui.foregroundSuccessData;
      }

      if (debugStateSnap.ui?.legacyDebugData) {
        uiDebugData.legacyDebugData = debugStateSnap.ui.legacyDebugData;
      }

      if (debugStateSnap.ui?.legacySuccessData) {
        uiDebugData.legacySuccessData = debugStateSnap.ui.legacySuccessData;
      }

      if (debugStateSnap.ui?.particleDebugData) {
        uiDebugData.particleDebugData = debugStateSnap.ui.particleDebugData;
      }

      // 現在の問題（ポインターアップ後もストロークが続く）に必要な情報のみ
      const pointerEventDebugData = {} as any;

      // 最新のポインターイベントのみ記録
      if (debugStateSnap.paplicoEngine?.input) {
        pointerEventDebugData.lastPointerEvent = {
          isMouseDown: debugStateSnap.paplicoEngine.input.isMouseDown,
          isPanning: debugStateSnap.paplicoEngine.input.isPanning,
          timestamp: debugStateSnap.paplicoEngine.input.lastEventTimestamp,
          pointerUpBrushTool:
            debugStateSnap.paplicoEngine.input.pointerUpBrushTool,
        };
      }

      // 描画状態の変化のみ記録
      if (debugStateSnap.webgpuEngine?.endDrawing) {
        pointerEventDebugData.drawingState = {
          isDrawingBefore:
            debugStateSnap.webgpuEngine.endDrawing.before?.isDrawing,
          isDrawingAfter:
            debugStateSnap.webgpuEngine.endDrawing.after?.isDrawing,
          hasCurrentStrokeBefore:
            debugStateSnap.webgpuEngine.endDrawing.before?.hasCurrentStroke,
          hasCurrentStrokeAfter:
            debugStateSnap.webgpuEngine.endDrawing.after?.hasCurrentStroke,
          timestamp: debugStateSnap.webgpuEngine.endDrawing.after?.timestamp,
        };
      }

      // 現在のプレビューストローク情報
      if (debugStateSnap.webgpuEngine?.renderingPreviewStroke) {
        pointerEventDebugData.currentPreviewStroke = {
          tempStrokeId:
            debugStateSnap.webgpuEngine.renderingPreviewStroke.tempStrokeId,
          pointsLength:
            debugStateSnap.webgpuEngine.renderingPreviewStroke.pointsLength,
        };
      }

      // 現在の問題調査に必要なデータのみ送信
      // コメントアウトして一時的に無効化
      /*
      if (Object.keys(strokeDebugData).length > 0) {
        for (const [key, data] of Object.entries(strokeDebugData)) {
          await saveDebugData({ filename: `${key}-debug`, json: data });
        }
      }

      if (Object.keys(uiDebugData).length > 0) {
        for (const [key, data] of Object.entries(uiDebugData)) {
          await saveDebugData({ filename: `${key}-debug`, json: data });
        }
      }
      */

      // ポインターイベントデバッグデータのみ保存
      if (Object.keys(pointerEventDebugData).length > 0) {
        await saveDebugData({
          filename: 'pointerEvent-debug',
          json: pointerEventDebugData,
        });
      }

      // WebGPUエンジンのデバッグデータを保存
      const webgpuEngineDebugData = {
        endDrawing: debugStateSnap.webgpuEngine?.endDrawing,
        previewStrokeCheck: debugStateSnap.webgpuEngine?.previewStrokeCheck,
        renderPreviewStrokeSkipped:
          debugStateSnap.webgpuEngine?.renderPreviewStrokeSkipped,
        renderingPreviewStroke:
          debugStateSnap.webgpuEngine?.renderingPreviewStroke,
        ioSurfaceDebug: debugStateSnap.webgpuEngine?.ioSurfaceDebug,
      };

      if (
        Object.keys(webgpuEngineDebugData).some(
          (key) =>
            webgpuEngineDebugData[key as keyof typeof webgpuEngineDebugData] !==
            undefined,
        )
      ) {
        await saveDebugData({
          filename: 'webgpuEngine-debug',
          json: webgpuEngineDebugData,
        });
      }

      // PaplicoEngineのデバッグデータを保存
      const paplicoEngineDebugData = debugStateSnap.paplicoEngine;
      if (paplicoEngineDebugData) {
        await saveDebugData({
          filename: 'paplicoEngine-debug',
          json: paplicoEngineDebugData,
        });
      }
    } catch (_error) {
      // エラーは無視
    }
  });

  // 100msごとにdebugStateからJSONデータを送信
  useEffect(() => {
    if (!isOpen || !paplico) return;

    const interval = setInterval(async () => {
      await submitDebugData();
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, paplico, submitDebugData]);

  if (!isOpen) return null;

  return (
    <div className="inset-y-0 right-0 w-80 bg-background border-l border-border z-50 overflow-hidden flex flex-col">
      <Card className="h-full flex flex-col gap-0 p-4 shadow-none border-none">
        <CardHeader className="pb-2 flex-none">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              デバッグパネル
            </span>
          </CardTitle>
        </CardHeader>

        <Separator />

        <CardContent className="flex-1 overflow-hidden p-2">
          <Tabs defaultValue="paplico" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 flex-none">
              <TabsTrigger value="paplico">Paplico</TabsTrigger>
              <TabsTrigger value="engine">エンジン</TabsTrigger>
              <TabsTrigger value="debug">デバッグ</TabsTrigger>
            </TabsList>

            <TabsContent
              value="paplico"
              className="flex-1 overflow-hidden mt-2"
            >
              <Tabs defaultValue="main" className="w-full h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-5 flex-none">
                  <TabsTrigger value="main">メイン</TabsTrigger>
                  <TabsTrigger value="document">ドキュメント</TabsTrigger>
                  <TabsTrigger value="history">履歴</TabsTrigger>
                  <TabsTrigger value="ui">UI</TabsTrigger>
                  <TabsTrigger value="hitTest">ヒット</TabsTrigger>
                </TabsList>

                <TabsContent
                  value="main"
                  className="flex-1 overflow-y-auto space-y-2 mt-2"
                >
                  <PaplicoDebugSection engine={paplico} />
                </TabsContent>

                <TabsContent
                  value="document"
                  className="flex-1 overflow-y-auto space-y-2 mt-2"
                >
                  <DocumentStateSection paplico={paplico} />
                </TabsContent>

                <TabsContent
                  value="history"
                  className="flex-1 overflow-y-auto space-y-2 mt-2"
                >
                  <HistoryDebugSection paplico={paplico} />
                </TabsContent>

                <TabsContent
                  value="ui"
                  className="flex-1 overflow-y-auto space-y-2 mt-2"
                >
                  <UIDebugSection />
                </TabsContent>

                <TabsContent
                  value="hitTest"
                  className="flex-1 overflow-y-auto space-y-2 mt-2"
                >
                  <HitTestDebugSection />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="engine" className="flex-1 overflow-hidden mt-2">
              <Tabs
                defaultValue="basic"
                className="w-full h-full flex flex-col"
              >
                <TabsList className="grid w-full grid-cols-2 flex-none">
                  <TabsTrigger value="basic">基本</TabsTrigger>
                  <TabsTrigger value="stroke">ストローク</TabsTrigger>
                </TabsList>

                <TabsContent
                  value="basic"
                  className="flex-1 overflow-y-auto space-y-2 mt-2"
                >
                  <EngineDebugSection engine={paplico} />
                </TabsContent>

                <TabsContent
                  value="stroke"
                  className="flex-1 overflow-y-auto space-y-2 mt-2"
                >
                  <StrokeDebugSection />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent
              value="debug"
              className="flex-1 overflow-y-auto space-y-2 mt-2"
            >
              <AutoPngSection engine={paplico} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
});

DebugPane.displayName = 'DebugPane';

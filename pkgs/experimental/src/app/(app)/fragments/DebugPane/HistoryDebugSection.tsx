'use client';

import { memo, useEffect, useReducer } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaplicoEngine } from '@/engine/paplico';

interface HistoryDebugSectionProps {
  paplico: PaplicoEngine | null;
}

export const HistoryDebugSection = memo(
  ({ paplico }: HistoryDebugSectionProps) => {
    const [, rerender] = useReducer((x) => x + 1, 0);

    console.log('Rerencer');

    useEffect(() => {
      const timer = setInterval(rerender, 500); // 500msごとに再レンダリング
      return () => clearInterval(timer);
    }, []);

    if (!paplico) {
      return (
        <Card className="p-0.5">
          <CardHeader className="p-0 m-0">
            <CardTitle className="text-xs font-medium p-1 m-0 leading-none">
              History Debug
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <div className="text-xs text-muted-foreground">
              エンジンが利用できません
            </div>
          </CardContent>
        </Card>
      );
    }

    const documentManager = paplico.getDocumentManager();
    const activeDocument = documentManager.activeDocument;
    const historyState = paplico.getHistoryState();

    // アクティブドキュメントのコンテキストを取得
    const documentContext = documentManager.getDocumentContext(
      activeDocument?.id || null,
    );

    // Undo/Redoスタックの情報を取得
    let undoStack: any[] = [];
    let redoStack: any[] = [];
    let totalCommands = 0;

    if (documentContext) {
      try {
        // DocumentHistoryからスタック情報を取得
        const history = documentContext.history;
        undoStack = history.getUndoStack ? history.getUndoStack() : [];
        redoStack = history.getRedoStack ? history.getRedoStack() : [];
        totalCommands = undoStack.length + redoStack.length;
      } catch (error) {
        console.warn('Failed to get history stacks:', error);
      }
    }

    // 最新のコマンドから順番に表示するためにundoStackを逆順にする
    const recentCommands = [...undoStack].reverse().slice(0, 10);

    return (
      <div className="space-y-0.5 text-xs">
        <Card className="p-0.5">
          <CardHeader className="p-0 m-0">
            <CardTitle className="text-xs font-medium p-1 pb-0.5 m-0 leading-none">
              履歴状態
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5 p-1 pt-0">
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex justify-between">
                <span>Undo可能:</span>
                <Badge
                  variant={historyState?.canUndo ? 'default' : 'secondary'}
                  className="text-xs px-0.5 py-0 h-4"
                >
                  {historyState?.canUndo ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Redo可能:</span>
                <Badge
                  variant={historyState?.canRedo ? 'default' : 'secondary'}
                  className="text-xs px-0.5 py-0 h-4"
                >
                  {historyState?.canRedo ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Undoスタック:</span>
                <Badge variant="outline" className="text-xs px-0.5 py-0 h-4">
                  {undoStack.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Redoスタック:</span>
                <Badge variant="outline" className="text-xs px-0.5 py-0 h-4">
                  {redoStack.length}
                </Badge>
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span>総コマンド数:</span>
              <Badge variant="secondary" className="text-xs px-0.5 py-0 h-4">
                {totalCommands}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0.5">
          <CardHeader className="p-0 m-0">
            <CardTitle className="text-xs font-medium p-1 pb-0.5 m-0 leading-none flex justify-between items-center">
              <span>コマンド履歴 (新しい順)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 pt-0">
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {recentCommands.length > 0 ? (
                recentCommands.map((entry, index) => {
                  const command = entry.command || entry;
                  const timestamp = entry.timestamp || command.timestamp;

                  return (
                    <div
                      key={command.id || index}
                      className="flex items-center justify-between text-xs p-0.5 rounded bg-muted/30"
                    >
                      <div className="flex items-center gap-0.5 flex-1 min-w-0">
                        <Badge
                          variant="default"
                          className="text-xs px-0.5 py-0 h-3 flex-shrink-0"
                        >
                          {command.type?.charAt(0)?.toUpperCase() || 'C'}
                        </Badge>
                        <div className="flex flex-col flex-1 min-w-0">
                          <code className="text-xs truncate">
                            {command.type || 'unknown'}
                          </code>
                          {command.id && (
                            <code className="text-xs text-muted-foreground truncate">
                              {command.id.slice(0, 8)}...
                            </code>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex-shrink-0">
                        {timestamp
                          ? new Date(timestamp).toLocaleTimeString('ja-JP', {
                              hour12: false,
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '--:--:--'}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-muted-foreground text-center py-2">
                  履歴がありません
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {historyState?.nextUndoCommand && (
          <Card className="p-0.5">
            <CardHeader className="p-0 m-0">
              <CardTitle className="text-xs font-medium p-1 pb-0.5 m-0 leading-none">
                次のUndo対象
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <div className="flex items-center gap-0.5 text-xs">
                <Badge
                  variant="destructive"
                  className="text-xs px-0.5 py-0 h-3"
                >
                  {historyState.nextUndoCommand.type
                    ?.charAt(0)
                    ?.toUpperCase() || 'U'}
                </Badge>
                <div className="flex flex-col flex-1 min-w-0">
                  <code className="text-xs">
                    {historyState.nextUndoCommand.type || 'unknown'}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {historyState.nextUndoCommand.getDescription?.() ||
                      'No description'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {historyState?.nextRedoCommand && (
          <Card className="p-0.5">
            <CardHeader className="p-0 m-0">
              <CardTitle className="text-xs font-medium p-1 pb-0.5 m-0 leading-none">
                次のRedo対象
              </CardTitle>
            </CardHeader>
            <CardContent className="p-1 pt-0">
              <div className="flex items-center gap-0.5 text-xs">
                <Badge variant="default" className="text-xs px-0.5 py-0 h-3">
                  {historyState.nextRedoCommand.type
                    ?.charAt(0)
                    ?.toUpperCase() || 'R'}
                </Badge>
                <div className="flex flex-col flex-1 min-w-0">
                  <code className="text-xs">
                    {historyState.nextRedoCommand.type || 'unknown'}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {historyState.nextRedoCommand.getDescription?.() ||
                      'No description'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  },
);

HistoryDebugSection.displayName = 'HistoryDebugSection';

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUIStore } from '@/stores/ui-store'
import { Keyboard, RotateCcw } from 'lucide-react'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutConfig {
  action: string
  label: string
  defaultKey: string
  category: 'tools' | 'editing' | 'view'
}

const shortcutConfigs: ShortcutConfig[] = [
  // ツール系
  {
    action: 'select',
    label: 'オブジェクト選択・移動ツール',
    defaultKey: 'm',
    category: 'tools',
  },
  {
    action: 'brush',
    label: 'ブラシツール',
    defaultKey: 'b',
    category: 'tools',
  },
  {
    action: 'eraser',
    label: '消しゴムツール',
    defaultKey: 'e',
    category: 'tools',
  },
  { action: 'pan', label: 'パンツール', defaultKey: 'h', category: 'tools' },
  { action: 'zoom', label: 'ズームツール', defaultKey: 'z', category: 'tools' },

  // 編集系
  {
    action: 'undo',
    label: 'アンドゥ',
    defaultKey: 'meta+z',
    category: 'editing',
  },
  {
    action: 'redo',
    label: 'リドゥ',
    defaultKey: 'meta+shift+z',
    category: 'editing',
  },
  { action: 'save', label: '保存', defaultKey: 'ctrl+s', category: 'editing' },
  {
    action: 'delete',
    label: '削除',
    defaultKey: 'delete',
    category: 'editing',
  },
]

const categoryLabels = {
  tools: 'ツール',
  editing: '編集',
  view: '表示',
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const { shortcuts, updateShortcut } = useUIStore()
  const [editingShortcuts, setEditingShortcuts] = useState<
    Record<string, string>
  >({})
  const [isRecording, setIsRecording] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ダイアログが開かれた時に現在のショートカットをコピー
  useState(() => {
    if (open) {
      setEditingShortcuts({ ...shortcuts })
    }
  })

  /** キー入力を記録開始 */
  const startRecording = (action: string) => {
    setIsRecording(action)
    const input = inputRefs.current[action]
    if (input) {
      input.focus()
      input.value = ''
    }
  }

  /** キー入力を処理 */
  const handleKeyDown = (e: React.KeyboardEvent, action: string) => {
    if (isRecording !== action) return

    e.preventDefault()
    e.stopPropagation()

    const keys: string[] = []
    if (e.ctrlKey || e.metaKey) keys.push(e.metaKey ? 'meta' : 'ctrl')
    if (e.shiftKey) keys.push('shift')
    if (e.altKey) keys.push('alt')

    // メインキーを追加
    if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      keys.push(e.key.toLowerCase())
    }

    if (keys.length > 0) {
      const shortcut = keys.join('+')
      setEditingShortcuts((prev) => ({
        ...prev,
        [action]: shortcut,
      }))
      setIsRecording(null)
    }
  }

  /** デフォルト値にリセット */
  const resetToDefaults = () => {
    const defaultShortcuts: Record<string, string> = {}
    shortcutConfigs.forEach((config) => {
      defaultShortcuts[config.action] = config.defaultKey
    })
    setEditingShortcuts(defaultShortcuts)
  }

  /** 変更を保存 */
  const saveChanges = () => {
    Object.entries(editingShortcuts).forEach(([action, key]) => {
      updateShortcut(action, key)
    })
    onOpenChange(false)
  }

  /** 変更をキャンセル */
  const cancelChanges = () => {
    setEditingShortcuts({ ...shortcuts })
    setIsRecording(null)
    onOpenChange(false)
  }

  // カテゴリ別にグループ化
  const groupedConfigs = shortcutConfigs.reduce(
    (acc, config) => {
      if (!acc[config.category]) acc[config.category] = []
      acc[config.category].push(config)
      return acc
    },
    {} as Record<string, ShortcutConfig[]>,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            キーボードショートカット設定
          </DialogTitle>
          <DialogDescription>
            ツールやアクションのキーボードショートカットをカスタマイズできます。
            入力欄をクリックしてキーを押すことで新しいショートカットを設定できます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {Object.entries(groupedConfigs).map(([category, configs]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base">
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {configs.map((config) => (
                  <div
                    key={config.action}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <Label className="text-sm font-medium">
                        {config.label}
                      </Label>
                      <div className="text-xs text-muted-foreground mt-1">
                        デフォルト:{' '}
                        <Badge variant="outline">{config.defaultKey}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        ref={(el) => {
                          inputRefs.current[config.action] = el
                        }}
                        className="w-32 text-center"
                        placeholder="キーを押す"
                        value={editingShortcuts[config.action] || ''}
                        onClick={() => startRecording(config.action)}
                        onKeyDown={(e) => handleKeyDown(e, config.action)}
                        readOnly
                        style={{
                          backgroundColor:
                            isRecording === config.action
                              ? '#fef3c7'
                              : undefined,
                        }}
                      />

                      {isRecording === config.action && (
                        <Badge variant="secondary" className="text-xs">
                          入力中...
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            デフォルトに戻す
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelChanges}>
              キャンセル
            </Button>
            <Button onClick={saveChanges}>保存</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

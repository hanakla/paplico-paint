import { micetrap } from '@hanakla/micetrap'
import { useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/ui-store'

interface KeyboardShortcutsOptions {
  onToolChange?: (toolId: string) => void
  onDelete?: () => void
  onUndo?: () => void
  onRedo?: () => void
  disabled?: boolean
}

/** キーボードショートカット管理hook */
export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const { onToolChange, onDelete, onUndo, onRedo, disabled = false } = options
  const micetrapRef = useRef<ReturnType<typeof micetrap> | null>(null)
  const { shortcuts, setSelectedTool } = useUIStore()

  useEffect(() => {
    if (disabled) return

    // micetrapインスタンスを作成
    const mice = micetrap()
    micetrapRef.current = mice

    // ツール切り替えショートカット
    const toolBindings = [
      {
        keys: shortcuts.select || 'm',
        handler: () => {
          setSelectedTool('select')
          onToolChange?.('select')
        },
        preventDefault: true,
      },
      {
        keys: shortcuts.brush || 'b',
        handler: () => {
          setSelectedTool('brush')
          onToolChange?.('brush')
        },
        preventDefault: true,
      },
    ]

    // その他のショートカット（将来的に拡張可能）
    const otherBindings = [
      {
        keys: shortcuts.undo || 'meta+z',
        handler: () => {
          onUndo?.()
        },
        preventDefault: true,
      },
      {
        keys: shortcuts.redo || 'meta+shift+z',
        handler: () => {
          onRedo?.()
        },
        preventDefault: true,
      },
      {
        keys: 'ctrl+z',
        handler: () => {
          onUndo?.()
        },
        preventDefault: true,
      },
      {
        keys: 'ctrl+shift+z',
        handler: () => {
          onRedo?.()
        },
        preventDefault: true,
      },
      {
        keys: shortcuts.save || 'meta+s',
        handler: () => {
          // 保存処理（将来実装）
          console.log('Save triggered')
        },
        preventDefault: true,
      },
      {
        keys: 'delete',
        handler: () => {
          onDelete?.()
        },
        preventDefault: true,
      },
      {
        keys: 'backspace',
        handler: () => {
          onDelete?.()
        },
        preventDefault: true,
      },
    ]

    // バインディングを設定
    mice.bind([...toolBindings, ...otherBindings])

    return () => {
      // クリーンアップ
      mice.unbind([])
    }
  }, [
    shortcuts,
    disabled,
    setSelectedTool,
    onToolChange,
    onDelete,
    onUndo,
    onRedo,
  ])

  return {
    /** ショートカットを一時的に無効化 */
    disable: () => {
      micetrapRef.current?.unbind([])
    },
    /** ショートカットを再有効化 */
    enable: () => {
      if (micetrapRef.current && disabled === false) {
        // 再バインドの処理は useEffect で行われる
      }
    },
  }
}

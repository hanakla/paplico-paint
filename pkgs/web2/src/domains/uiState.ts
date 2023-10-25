import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type EditorStore = {
  toolbarPosition: { x: number; y: number } | null
  canvasTransform: CanvasTransform

  setToolbarPosition: (
    callback: (
      prev: EditorStore['toolbarPosition'],
    ) => EditorStore['toolbarPosition'],
  ) => void
  setCanvasTransform: (
    translator: (prev: CanvasTransform) => CanvasTransform,
  ) => void
}

export const useEditorStore = create(
  persist<EditorStore>(
    (set, get) => ({
      toolbarPosition: null,
      canvasTransform: { x: 0, y: 0, scale: 1, rotateDeg: 0 },

      setToolbarPosition: (callback) => {
        set({ toolbarPosition: callback(get().toolbarPosition) })
      },
      setCanvasTransform: (translator) => {
        set({ canvasTransform: translator(get().canvasTransform) })
      },
    }),
    {
      name: 'ui-state',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

type CanvasTransform = {
  x: number
  y: number
  scale: number
  rotateDeg: number
}

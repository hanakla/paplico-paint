import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type EditorStore = {
  toolbarPosition: { x: number; y: number } | null

  setToolbarPosition: (
    callback: (
      prev: EditorStore['toolbarPosition'],
    ) => EditorStore['toolbarPosition'],
  ) => void
}

export const useEditorStore = create(
  persist<EditorStore>(
    (set, get) => ({
      toolbarPosition: null,

      setToolbarPosition: (callback) => {
        set({ toolbarPosition: callback(get().toolbarPosition) })
      },
    }),
    {
      name: 'ui-state',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

import { StoreApi, create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Shortcuts, mergeShortcuts } from './shortcut'
import Paplico from '@paplico/core-new'

type EditorStore = {
  toolbarPosition: { x: number; y: number } | null
  filterPaneExpandState: { [filterUid: string]: boolean }
  canvasTransform: CanvasTransform
  shortcutOverrides: Partial<Shortcuts>
  fileHandlers: {
    [docUid: string]: FileSystemFileHandle
  }
  strokeCompositonBeforeChnageToVectorTool: Paplico.State['strokeComposition']

  setFileHandlerForDocument: (
    docUid: string,
    handle: FileSystemFileHandle,
  ) => void
  setToolbarPosition: (
    callback: (
      prev: EditorStore['toolbarPosition'],
    ) => EditorStore['toolbarPosition'],
  ) => void
  setPaneExpandedFilterState: (filterUid: string, state: boolean) => void
  setCanvasTransform: (
    translator: (prev: CanvasTransform) => CanvasTransform,
  ) => void

  getPaneExpandedFilterUids(): string[]
  getShortcuts(): Shortcuts

  set: StoreApi<EditorStore>['setState']
}

export const useEditorStore = create(
  persist<EditorStore>(
    (set, get) => ({
      toolbarPosition: null,
      filterPaneExpandState: {},
      canvasTransform: { x: 0, y: 0, scale: 1, rotateDeg: 0 },
      shortcutOverrides: {},
      fileHandlers: {},
      strokeCompositonBeforeChnageToVectorTool: 'normal',

      setFileHandlerForDocument: (docUid, handle) => {
        set({ fileHandlers: { ...get().fileHandlers, [docUid]: handle } })
      },
      setPaneExpandedFilterState: (filterUid, expanded) => {
        set({
          filterPaneExpandState: {
            ...get().filterPaneExpandState,
            [filterUid]: expanded,
          },
        })
      },
      setToolbarPosition: (callback) => {
        set({ toolbarPosition: callback(get().toolbarPosition) })
      },
      setCanvasTransform: (translator) => {
        set({ canvasTransform: translator(get().canvasTransform) })
      },

      getPaneExpandedFilterUids() {
        return Object.entries(get().filterPaneExpandState)
          .filter(([_, state]) => state)
          .map(([uid, _]) => uid)
      },

      getShortcuts() {
        return mergeShortcuts(get().shortcutOverrides)
      },

      set,
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

import { StoreApi, createStore } from 'zustand/vanilla'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Shortcuts, mergeShortcuts } from './shortcut'
import Paplico from '@paplico/core-new'
import { createUseStore } from '@/utils/zustand'

type EditorStore = {
  toolbarPosition: { x: number; y: number } | null
  filterPaneExpandState: { [filterUid: string]: boolean }
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

  getPaneExpandedFilterUids(): string[]
  getShortcuts(): Shortcuts

  set: StoreApi<EditorStore>['setState']
}

type Persist = Omit<EditorStore, 'toolbarPosition'>

export const editorStore = createStore(
  persist<EditorStore>(
    (set, get) => ({
      toolbarPosition: null,
      filterPaneExpandState: {},
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
      partialize: ({ toolbarPosition, ...state }) => state as any,
    },
  ),
)

export const useEditorStore = createUseStore(editorStore)

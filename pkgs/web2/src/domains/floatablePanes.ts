import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const FloatablePaneIds = {
  brushSettings: 'brushSettings',
  layers: 'layers',
}

export type FloatablePaneIds =
  (typeof FloatablePaneIds)[keyof typeof FloatablePaneIds]

type FloatablePosition = {
  originX: 'left' | 'right'
  originY: 'top' | 'bottom'
  x: number
  y: number
}

type FloatablePaneState = {
  floatingPanes: Record<
    string,
    {
      position: FloatablePosition
      paneState: Record<string, any>
    }
  >
  setPosition: (id: FloatablePaneIds, position: FloatablePosition) => void
  setPaneState: <T extends Record<string, any>>(
    id: FloatablePaneIds,
    paneState: T,
  ) => void
}

export const useFloatablePaneStore = create(
  persist<FloatablePaneState>(
    (set, get) => ({
      floatingPanes: {},
      setPosition: (id, position) => {
        set((state) => {
          state.floatingPanes[id] = {
            position,
            paneState: state.floatingPanes[id]?.paneState ?? {},
          }

          return state
        })
      },
      setPaneState: (id, paneState) => {
        return set((state) => {
          if (state.floatingPanes[id]) {
            state.floatingPanes[id].paneState = paneState
          }
          return state
        })
      },
    }),
    {
      name: 'floatable-panes',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

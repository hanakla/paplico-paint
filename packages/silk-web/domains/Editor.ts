import { createSlice } from '@fleur/lys'
import { SliceActionContext } from '@fleur/lys/dist/slice'
import { debounce } from 'debounce'
import { Silk } from '../../silk-core/src'

interface State {
  engine: Silk | null
  activeObjectId: string | null
  activeObjectPointIndex: number[]
}

export const EditorSlice = createSlice(
  {
    actions: {
      setEngine: ({ draft }, engine: Silk) => {
        draft.engine = engine
      },
      setActiveLayer: ({ draft }, layerId: string) => {
        if (layerId === draft.engine?.activeLayer?.id) return

        draft.engine?.setActiveLayer(layerId)
        draft.activeObjectId = null
      },
      setActiveObject: ({ draft }, objectId: string | null) => {
        draft.activeObjectId = objectId ?? null
      },
      setActiveObjectPoint: ({ draft }, indices: number[]) => {
        draft.activeObjectPointIndex = indices
      },
      rerenderCanvas: debounce(
        ({ draft }: SliceActionContext<State>) => {
          draft.engine?.rerender()
        },
        100,
        true
      ),
    },
    computed: {
      currentBrush: ({ engine }) => engine?.currentBrush,
      // activeObject
    },
  },
  (): State => ({
    engine: null,
    activeObjectId: null,
  })
)

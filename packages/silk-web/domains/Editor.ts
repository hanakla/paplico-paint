import { createSlice } from '@fleur/lys'
import { SliceActionContext } from '@fleur/lys/dist/slice'
import { debounce } from 'debounce'
import { Silk, SilkEntity } from '../../silk-core/src'

type Tool = 'cursor' | 'draw' | 'erase'

interface State {
  engine: Silk | null
  currentTool: Tool
  activeObjectId: string | null
  activeObjectPointIndex: number[]
  clipboard: SilkEntity.VectorObject | null
}

export const EditorSlice = createSlice(
  {
    actions: {
      setEngine: ({ draft }, engine: Silk) => {
        draft.engine = engine as any
      },
      setTool: ({ draft }, tool: Tool) => {
        draft.currentTool = tool

        if (tool === 'cursor') {
          draft.engine!.pencilMode = 'none'
        } else if (tool === 'draw' || tool === 'erase') {
          draft.engine!.pencilMode = tool
        }
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
      activeLayer: ({ engine }) => engine?.activeLayer,
      activeObject: ({
        engine,
        activeObjectId,
      }): SilkEntity.VectorObject | null => {
        if (engine?.activeLayer?.layerType !== 'vector') return null
        return engine?.activeLayer?.objects.find(
          (obj) => obj.id === activeObjectId
        ) as any
      },
    },
  },
  (): State => ({
    engine: null,
    currentTool: 'cursor',
    activeObjectId: null,
    activeObjectPointIndex: [],
  })
)

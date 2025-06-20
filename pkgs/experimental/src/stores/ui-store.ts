import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface Tool {
  id: string
  name: string
  icon: string
  active: boolean
}

interface UIState {
  tools: Tool[]
  selectedTool: string
  layersPanelOpen: boolean
  brushPanelOpen: boolean
  filtersPanelOpen: boolean
  debugPanelOpen: boolean
  colorPickerOpen: boolean
  sidebarWidth: number
  selectedColor: string
  brushSize: number
  brushOpacity: number
  showGrid: boolean
  showRuler: boolean
  zoomLevel: number
  panelLayout: 'left' | 'right' | 'bottom'
  theme: 'light' | 'dark'
  shortcuts: Record<string, string>
}

interface UIActions {
  setSelectedTool: (toolId: string) => void
  toggleLayersPanel: () => void
  toggleBrushPanel: () => void
  toggleFiltersPanel: () => void
  toggleDebugPanel: () => void
  toggleColorPicker: () => void
  setSidebarWidth: (width: number) => void
  setSelectedColor: (color: string) => void
  setBrushSize: (size: number) => void
  setBrushOpacity: (opacity: number) => void
  toggleGrid: () => void
  toggleRuler: () => void
  setZoomLevel: (level: number) => void
  setPanelLayout: (layout: 'left' | 'right' | 'bottom') => void
  setTheme: (theme: 'light' | 'dark') => void
  updateShortcut: (action: string, key: string) => void
}

const initialTools: Tool[] = [
  { id: 'brush', name: 'ブラシ', icon: 'Brush', active: true },
  { id: 'eraser', name: '消しゴム', icon: 'Eraser', active: false },
  { id: 'select', name: '選択', icon: 'MousePointer', active: false },
  { id: 'pan', name: 'パン', icon: 'Hand', active: false },
  { id: 'zoom', name: 'ズーム', icon: 'ZoomIn', active: false },
  { id: 'eyedropper', name: 'スポイト', icon: 'Pipette', active: false },
]

export const useUIStore = create<UIState & UIActions>()(
  immer((set) => ({
    tools: initialTools,
    selectedTool: 'brush',
    layersPanelOpen: true,
    brushPanelOpen: false,
    filtersPanelOpen: false,
    debugPanelOpen: true,
    colorPickerOpen: false,
    sidebarWidth: 300,
    selectedColor: '#000000',
    brushSize: 10,
    brushOpacity: 100,
    showGrid: false,
    showRuler: false,
    zoomLevel: 100,
    panelLayout: 'right',
    theme: 'light',
    shortcuts: {
      brush: 'b',
      eraser: 'e',
      select: 'm',
      pan: 'h',
      zoom: 'z',
      undo: 'meta+z',
      redo: 'meta+shift+z',
      save: 'ctrl+s',
      delete: 'delete',
    },

    setSelectedTool: (toolId) =>
      set((state) => {
        state.selectedTool = toolId
        state.tools = state.tools.map((tool) => ({
          ...tool,
          active: tool.id === toolId,
        }))
      }),

    toggleLayersPanel: () =>
      set((state) => {
        state.layersPanelOpen = !state.layersPanelOpen
      }),

    toggleBrushPanel: () =>
      set((state) => {
        state.brushPanelOpen = !state.brushPanelOpen
      }),

    toggleFiltersPanel: () =>
      set((state) => {
        state.filtersPanelOpen = !state.filtersPanelOpen
      }),

    toggleDebugPanel: () =>
      set((state) => {
        state.debugPanelOpen = !state.debugPanelOpen
      }),

    toggleColorPicker: () =>
      set((state) => {
        state.colorPickerOpen = !state.colorPickerOpen
      }),

    setSidebarWidth: (width) =>
      set((state) => {
        state.sidebarWidth = Math.max(200, Math.min(600, width))
      }),

    setSelectedColor: (color) =>
      set((state) => {
        state.selectedColor = color
      }),

    setBrushSize: (size) =>
      set((state) => {
        state.brushSize = Math.max(1, Math.min(100, size))
      }),

    setBrushOpacity: (opacity) =>
      set((state) => {
        state.brushOpacity = Math.max(0, Math.min(100, opacity))
      }),

    toggleGrid: () =>
      set((state) => {
        state.showGrid = !state.showGrid
      }),

    toggleRuler: () =>
      set((state) => {
        state.showRuler = !state.showRuler
      }),

    setZoomLevel: (level) =>
      set((state) => {
        state.zoomLevel = Math.max(10, Math.min(500, level))
      }),

    setPanelLayout: (layout) =>
      set((state) => {
        state.panelLayout = layout
      }),

    setTheme: (theme) =>
      set((state) => {
        state.theme = theme
      }),

    updateShortcut: (action, key) =>
      set((state) => {
        state.shortcuts[action] = key
      }),
  })),
)

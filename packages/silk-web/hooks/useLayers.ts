import { useEffect, useMemo } from "react"
import { arrayMove } from "react-sortable-hoc"
import { useUpdate } from "react-use"
import { SilkHelper } from "../../silk-core/src"
import { LayerTypes } from "../../silk-core/src/Entity"
import { useSilkEngine } from "./useSilkEngine"

export const useLayerControl = () => {
  const engine = useSilkEngine()
  const rerender = useUpdate()

  useEffect(() => {
    if (!engine) return

    engine.currentDocument?.on('layersChanged', rerender)
    engine.on('activeLayerChanged', rerender)
  }, [])

  return useMemo(() => ({
    get layers() {
      return engine?.currentDocument?.layers ?? []
    },
    get activeLayer(): LayerTypes | null {
      return engine?.activeLayer ?? null
    },
    addLayer: (newLayer: LayerTypes, {aboveLayerId}: {aboveLayerId?: string}) => {
      engine?.currentDocument?.addLayer(newLayer, {aboveLayerId})
      engine?.setActiveLayer(newLayer.id)
      // engine?.rerender()
      // rerender()
    },
    moveLayer: (oldIndex: number, newIndex: number) => {
      engine?.currentDocument?.sortLayer((layers) => {
        return arrayMove(layers, oldIndex, newIndex)
      })
      // rerender()
    },
    setActiveLayer: (id: string) => {
      engine?.setActiveLayer(id)
      rerender()
    },
    changeOpacity: (id: string | null | undefined, opacity: number) => {
      const layer = engine?.currentDocument?.layers.find(layer => layer.id === id)
      if (!layer) return

      layer.opacity = opacity

      engine?.rerender()
      rerender()
    },
    changeCompositeMode: (id: string | null | undefined, mode: string) => {
      const layer = engine?.currentDocument?.layers.find(layer => layer.id === id)
      if (!layer) return

      if (!SilkHelper.validCompositeMode(mode)) return
      layer.compositeMode = mode as any

      engine?.rerender()
      rerender()
    },
    toggleVisibility: (id: string | null | undefined) => {
      const layer = engine?.currentDocument?.layers.find(layer => layer.id === id)
      if (!layer) return

      layer.visible = !layer.visible

      engine?.rerender()
      rerender()
    },
    getPreview(id: string | null | undefined) {
      return engine?.previews.get(id)
    }
  }), [engine])
}

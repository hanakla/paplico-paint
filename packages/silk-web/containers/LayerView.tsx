import { MouseEvent, useCallback, useContext, useEffect, useReducer } from "react";
import { SilkEntity } from "silk-core";
import { EngineContext } from "../lib/EngineContext";

export function LayerView() {
  const engine = useContext(EngineContext)
  const [,rerender] = useReducer(s => s + 1, 0)

  const handleAddLayer = useCallback(() => {
    const newLayer = new SilkEntity.Layer({ width: 1000, height: 1000})

    engine.currentDocument?.addLayer(newLayer, {aboveLayerId: engine.activeLayer.id})
    engine.setActiveLayer(newLayer.id)
    rerender()
  }, [engine])

  useEffect(() => {
    engine?.on('rerender', rerender)
    return () => engine?.off('rerender', rerender)
  }, [engine])

  return (
    <div css="max-height: 40vh; overflow: auto; font-size: 12px;">
      <div css={`
        display: flex;
        padding: 8px;
        position: sticky;
        top: 0;
        background-color: #464b4e;
    `}>
        レイヤー
        <div css='margin-left: auto' onClick={handleAddLayer}>＋</div>
      </div>

      {engine?.currentDocument?.layers.map(layer => (
        <LayerItem
          layer={layer}
          active={engine.activeLayer.id === layer.id}
          previewUrl={engine.previews.get(layer.id)}
        />
      ))}
    </div>
  )
}

function LayerItem({layer, active, previewUrl}: {layer: SilkEntity.LayerTypes, active: boolean, previewUrl: string}) {
  const engine = useContext(EngineContext)

  const handleToggleVisibility = useCallback(() => {
    layer.visible = !layer.visible
    engine.rerender()
  }, [layer.visible, engine])

  const handleChangeActiveLayer = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).matches('[data-ignore-click]')) return
    engine.setActiveLayer(layer.id)
    engine.rerender()
  }, [layer.id, engine])

  return (
    <div css={`
      display: flex;
      width: 100%;
      align-items: center;
      padding: 8px;
      cursor: default;
      ${active ? `background-color: rgba(255,255,255,.2)` : ''}
    `}
      onClick={handleChangeActiveLayer}
    >
      <img css="width: 24px; height: 24px; flex: none;" src={previewUrl}/>
      <div css={`
        margin-left: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: auto;
        ::-webkit-scrollbar { display: none; }
      `}>{layer.id}</div>
      <div css={`${layer.visible ? '' : 'opacity: .5;'}`} onClick={handleToggleVisibility} data-ignore-click>
        👀
      </div>
    </div>
  )
}

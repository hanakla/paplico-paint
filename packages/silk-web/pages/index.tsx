import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { EngineContextProvider } from '../lib/EngineContext'
import { Silk, SilkEntity } from 'silk-core'
import { LayerView } from '../containers/LayerView'
import { BrushView } from '../containers/BrushView'

export default function Index({}) {
  const engine = useRef<Silk | null>(null)
  const canvasRef = useRef<HTMLCanvasElement| null>(null)
  const [position, setPosition] = useState({x: 0, y: 0})
  const [,rerender] = useReducer(s => s + 1, 0)
  const [opened, toggle] = useReducer(s => !s, false)

  useEffect(() => {
    (window as any).engine = engine.current = new Silk({canvas: canvasRef.current! })

    const document = new SilkEntity.Document({width: 1000, height: 1000})
    const layer = new SilkEntity.Layer({width: 1000, height: 1000})
    engine.current.setDocument(document)
    document.layers.push(layer)
    engine.current.setActiveLayer(layer.id)

    engine.current.on('rerender', () => {
      console.log('ok')
      rerender()
    })

    window.addEventListener("wheel", (e) => {
      console.log(e.deltaX, e.deltaY)
      setPosition(({x, y}) => ({x: x - e.deltaX * .5, y: y - e.deltaY * .5}))
      // if (event.deltaX < 0) {
      //      console.log("下方向へホイール")
      //  } else if (event.wheelDeltaY > 0) {
      //      console.log("上方向へホイール")
      //  }
    })

    function zoom(e) {
      console.log(e.scale)
      e.preventDefault()
    }

    window.document.addEventListener('gesturestart', zoom)
    window.document.addEventListener('gesturechange', zoom)
    window.document.addEventListener('gestureend', zoom)

    rerender()
  }, [])

  return (
    <EngineContextProvider value={engine.current}>
      <div css={`
        display: flex;
        flex-flow: row;
        width: 100%;
        height: 100%;
        background-color: #a8a8a8;
        color: #cfcfcf;
      `}>
        <div
          css={`
            display: flex;
            flex-flow: column;
            max-width: 200px;
            background-color: #464b4e;
            transition: width .3s ease-in-out;
          `}
          style={{ width: opened ? '100%' : '32px'}}
        >
          <LayerView />
          <div css={`
              display: flex;
              margin-top: 8px;
              padding: 8px;
              border-top: 1px solid #73757c;
          `}>
              エフェクト
              <div css='margin-left: auto'>＋</div>
            </div>
          <div css="display: flex; padding: 8px; margin-top: auto">
            <div css="margin-right: auto; cursor: default;" onClick={toggle}>三</div>
          </div>
        </div>


          <div css={`
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          `}>
            <canvas css='background-color: white;' style={{transform: `scale(.5) translate(${position.x}px, ${position.y}px)`}} ref={canvasRef} />
            <div css={`
              position: absolute;
              left: 50%;
              bottom: 16px;
              transform: translateX(-50%);
            `}>
              <BrushView />
            </div>
          </div>
      </div>
    </EngineContextProvider>
  )
}

// Index.getInitialProps = async (ctx: FleurishNextPageContext) => {
//   // await Promise.all([
//   //   ctx.executeOperation(AppOps.asyncIncrement, (Math.random() * 1000) | 0),
//   //   ctx.executeOperation(AppOps.settleAccessDate),
//   // ])

//   // return {}
//   return {}
// }


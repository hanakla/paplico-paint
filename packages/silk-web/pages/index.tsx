import type {} from '../utils/styled-theme'
import type {} from 'styled-components/cssprop'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useClickAway, useDrop, useMedia, useToggle, useUpdate } from 'react-use'
import {serverSideTranslations} from 'next-i18next/serverSideTranslations'
import {loadImageFromBlob} from '@hanakla/arma'
import { EngineContextProvider } from '../lib/EngineContext'
import { Silk, SilkEntity, SilkHelper } from 'silk-core'
import { LayerView } from '../containers/LayerView'
import { MainActions } from '../containers/MainActions/MainActions'
import { ControlsOverlay } from '../containers/ControlsOverlay'
import { GetStaticProps } from 'next'
import i18nConfig from '../next-i18next.config'
import { narrow } from '../utils/responsive'
import { usePinch, } from 'react-use-gesture'
import { createGlobalStyle } from 'styled-components'

export default function Index({}) {
  const engine = useRef<Silk | null>(null)
  const canvasRef = useRef<HTMLCanvasElement| null>(null)
  const editAreaRef = useRef<HTMLDivElement|null>(null)
  const sidebarRef = useRef<HTMLDivElement |null>(null)

  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, true)
  const [position, setPosition] = useState({x: 0, y: 0})
  const rerender = useUpdate()
  const [sidebarOpened, sidebarToggle] = useToggle(!isNarrowMedia)
  const [scale, setScale] = useState(.5)
  const [rotate, setRotate] = useState(0)

  const handleOnDrop = useCallback(async (files: File[]) => {
    if (!engine.current?.currentDocument) return

    let lastLayerId: string | null = engine.current.activeLayer

    for (const file of files) {
      const {image} = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)
      engine.current.currentDocument.addLayer(layer, {aboveLayerId: lastLayerId})
      lastLayerId = layer.id
    }

    engine.current.rerender()
  }, [])

  const dragState = useDrop({onFiles: handleOnDrop})

  usePinch(({delta: [d, r]}) => {
    setScale(scale => Math.max(.1, scale + d / 400))
    // setRotate(rotate => rotate + r)
  }, {domTarget: editAreaRef, eventOptions: {passive: false}})


  useClickAway(sidebarRef, () => {
    if (!isNarrowMedia) return
    sidebarToggle(false)
  })

  useEffect(() => {
    (window as any).engine = engine.current = new Silk({canvas: canvasRef.current! })

    const document = SilkEntity.Document.create({width: 1000, height: 1000})
    engine.current.setDocument(document)

    const layer = SilkEntity.RasterLayer.create({width: 1000, height: 1000})
    const vector = SilkEntity.VectorLayer.create({width: 1000, height: 1000})
    document.layers.push(vector)
    document.layers.push(layer)
    engine.current.setActiveLayer(layer.id)

    engine.current.on('rerender', rerender)

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // window.addEventListener('mousewheel', e => {
    //   // e.preventDefault()
    //   e.stopPropagation()
    // }, {passive: false})
    rerender()
  }, [])

  useEffect(() => {
    const handleCanvasWheel = (e:WheelEvent) => {
      setPosition(({x, y}) => ({x: x - e.deltaX * .5, y: y - e.deltaY * .5}))
      e.preventDefault()
    }

    editAreaRef.current?.addEventListener('wheel', handleCanvasWheel, {passive: false })
    return () => editAreaRef.current?.removeEventListener('wheel', handleCanvasWheel)
  },[])

  useEffect(() => {
    if (!engine.current) return
    engine.current.canvasScale = scale
  }, [scale, engine.current])

  return (
    <EngineContextProvider value={engine.current}>
      <TouchActionStyle />
      <div
        css={`
          display: flex;
          flex-flow: row;
          width: 100%;
          height: 100%;
          background-color: ${({theme}) => theme.surface.black};
          color: ${({theme}) => theme.text.white};
        `}
      >
        <div
          ref={sidebarRef}
          css={`
            position: relative;
            display: flex;
            flex-flow: column;
            width: ${isNarrowMedia ? '32px' : '200px'};
            max-width: 200px;
          `}
        >
          <div
            css={`
              position: absolute;
              left: 0;
              top: 0;
              z-index: 1;
              display: flex;
              flex-flow: column;
              height: 100%;
              transition: width .2s ease-in-out;
              background-color: ${({theme}) => theme.surface.sidebarBlack};
            `}
            style={{ width: (!isNarrowMedia || sidebarOpened) ? '200px' : '32px'}}
          >
            <LayerView />
            <div css={`
                display: flex;
                padding: 8px;
                border-top: 1px solid #73757c;
            `}>
                エフェクト
                <div css='margin-left: auto'>＋</div>
            </div>
            <div css="display: flex; padding: 8px; margin-top: auto;">
              <div css="margin-right: auto; cursor: default;" onClick={sidebarToggle}>三</div>
            </div>
          </div>
        </div>
        <div
          ref={editAreaRef}
          css={`
            position: relative;
            display: flex;
            flex: 1;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          `}
        >
          {dragState.over && (
            <div css={`
              position: absolute;
              top: 0;
              left: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
              z-index: 1;
              background-color: rgba(0,0,0,.5);
            `}>
              ドロップして画像を追加
            </div>
          )}
          <div css="position: absolute;" style={{transform: `scale(${scale}) rotate(${rotate}deg) translate(${position.x}px, ${position.y}px)`}}>
            <ControlsOverlay scale={scale} />
            <canvas css='background-color: white; box-shadow: 0 0 16px rgba(0,0,0,.1)' ref={canvasRef} />
          </div>
          <div css={`
            position: absolute;
            left: 50%;
            bottom: 16px;
            transform: translateX(-50%);
          `}>
            <MainActions />
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


const TouchActionStyle = createGlobalStyle`
  html, body { touch-action: none; }
`

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale!, ['common'], i18nConfig)),
      // Will be passed to the page component as props
    },
  };
}

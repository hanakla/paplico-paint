import type {} from '../utils/styled-theme'

import React, {
  ChangeEvent,
  TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useClickAway, useDrop, useToggle, useUpdate } from 'react-use'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { loadImageFromBlob, useAsyncEffect } from '@hanakla/arma'
import { EngineContextProvider } from '../lib/EngineContext'
import { Silk, SilkEntity, SilkHelper } from 'silk-core'
import { LayerView } from '../containers/LayerView'
import { MainActions } from '../containers/MainActions/MainActions'
import { ControlsOverlay } from '../containers/ControlsOverlay'
import { GetStaticProps } from 'next'
import i18nConfig from '../next-i18next.config'
import { narrow } from '../utils/responsive'
import { usePinch } from 'react-use-gesture'
import { createGlobalStyle, css } from 'styled-components'
import { DebugView } from '../containers/DebugView'
import { useSpring, animated } from 'react-spring'
import { Menu, Restart } from '@styled-icons/remix-line'
import { Provider } from 'jotai'
import { LysContext, useLysSliceRoot } from '@fleur/lys'
import { EditorSlice } from '../domains/Editor'
import { useTap } from '../hooks/useTap'
import { useTranslation } from 'next-i18next'
import { CSSProp } from 'styled-components'
import Head from 'next/head'
import { useGlobalMouseTrap } from '../hooks/useMouseTrap'
import { Sidebar } from '../components/Sidebar'
import { clearScreenDown } from 'readline'
import { FilterView } from '../containers/FilterView'
import { useMedia } from '../utils/hooks'

function IndexContent({}) {
  const { t } = useTranslation('app')

  const [editorState, editorActions] = useLysSliceRoot(EditorSlice)
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`, false)

  const engine = useRef<Silk | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editAreaRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)

  const [position, setPosition] = useState({ x: 0, y: 0 })
  const rerender = useUpdate()
  const [sidebarOpened, sidebarToggle] = useToggle(!isNarrowMedia)
  const [scale, setScale] = useState(0.5)
  const [rotate, setRotate] = useState(0)
  // const sidebarStyles = useSpring({
  //   width: isNarrowMedia === false || sidebarOpened ? 200 : 32,
  // })

  const handleOnDrop = useCallback(async (files: File[]) => {
    if (!engine.current?.currentDocument) return

    let lastLayerId: string | null = engine.current.activeLayer?.id ?? null

    for (const file of files) {
      const { image } = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)
      engine.current.currentDocument.addLayer(layer, {
        aboveLayerId: lastLayerId,
      })
      lastLayerId = layer.id
    }

    engine.current.rerender()
  }, [])

  const handleTapEditArea = useCallback(
    ({ touches }: TouchEvent<HTMLDivElement>) => {
      if (touches.length === 2) console.log('undo')
      if (touches.length === 3) console.log('redo')
    },
    []
  )

  const handleChangeDisableFilters = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      editorActions.setRenderSetting({
        disableAllFilters: currentTarget.checked,
      })
    },
    []
  )

  const dragState = useDrop({ onFiles: handleOnDrop })
  // const tapBind = useTap(handleTapEditArea)

  useGlobalMouseTrap(
    [
      { key: 'v', handler: () => editorActions.setTool('cursor') },
      { key: 'b', handler: () => editorActions.setTool('draw') },
      { key: 'e', handler: () => editorActions.setTool('erase') },
      { key: 'p', handler: () => editorActions.setTool('shape-pen') },
      {
        key: 'tab',
        handler: (e) => {
          e.preventDefault()
          sidebarToggle()
        },
      },
    ],
    []
  )

  usePinch(
    ({ delta: [d, r] }) => {
      setScale((scale) => Math.max(0.1, scale + d / 400))
      // setRotate(rotate => rotate + r)
    },
    { domTarget: editAreaRef, eventOptions: { passive: false } }
  )

  useClickAway(sidebarRef, () => {
    if (!isNarrowMedia) return
    sidebarToggle(false)
  })

  useAsyncEffect(async () => {
    ;(window as any).engine = engine.current = await Silk.create({
      canvas: canvasRef.current!,
    })
    editorActions.setEngine(engine.current)

    const document = SilkEntity.Document.create({ width: 1000, height: 1000 })
    await engine.current.setDocument(document)

    const layer = SilkEntity.RasterLayer.create({ width: 1000, height: 1000 })
    const vector = SilkEntity.VectorLayer.create({ width: 1000, height: 1000 })
    const filter = SilkEntity.FilterLayer.create({})

    vector.filters.push(
      SilkEntity.Filter.create({
        filterId: '@silk-core/gauss-blur',
        settings: {},
      }),
      SilkEntity.Filter.create({
        filterId: '@silk-core/chromatic-aberration',
        settings: {},
      })
    )

    document.layers.push(layer)
    document.layers.push(vector)
    document.layers.push(filter)
    editorActions.setActiveLayer(vector.id)

    engine.current.on('rerender', rerender)
    engine.current.rerender()

    editorActions.setFill({
      type: 'linear-gradient',
      colorPoints: [
        { color: { r: 0, g: 255, b: 255, a: 1 }, position: 0 },
        { color: { r: 128, g: 255, b: 200, a: 1 }, position: 1 },
      ],
      start: { x: -100, y: -100 },
      end: { x: 100, y: 100 },
      opacity: 1,
    })

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })

    // window.addEventListener('mousewheel', e => {
    //   // e.preventDefault()
    //   e.stopPropagation()
    // }, {passive: false})
    rerender()

    return () => {}
  }, [])

  useEffect(() => {
    const handleCanvasWheel = (e: WheelEvent) => {
      setPosition(({ x, y }) => ({
        x: x - e.deltaX * 0.5,
        y: y - e.deltaY * 0.5,
      }))
      e.preventDefault()
    }

    editAreaRef.current?.addEventListener('wheel', handleCanvasWheel, {
      passive: false,
    })
    return () =>
      editAreaRef.current?.removeEventListener('wheel', handleCanvasWheel)
  }, [])

  useEffect(() => {
    if (!engine.current) return
    engine.current.canvasScale = scale
  }, [scale, engine.current])

  return (
    <EngineContextProvider value={engine.current}>
      <TouchActionStyle />
      <Head>
        <meta
          name="viewport"
          content="viewport-fit=cover, width=device-width, initial-scale=1"
        />
      </Head>
      <div
        ref={rootRef}
        css={css`
          position: relative;
          display: flex;
          flex-flow: row;
          width: 100%;
          height: 100%;
          background-color: ${({ theme }) => theme.surface.black};
          color: ${({ theme }) => theme.text.white};
        `}
        tabIndex={-1}
      >
        <>
          {!isNarrowMedia && (
            <div
              ref={sidebarRef}
              css={css`
                position: relative;
                display: flex;
                flex-flow: column;
                max-width: 200px;
                overflow: hidden;
              `}
              // style={sidebarStyles}
              style={{
                width: sidebarOpened ? 200 : 32,
              }}
            >
              <Sidebar
                css={css`
                  position: absolute;
                  left: 0;
                  top: 0;
                  z-index: 1;
                  display: flex;
                  flex-flow: column;
                  width: 200px;
                  height: 100%;
                  padding-bottom: env(safe-area-inset-bottom);
                  transition: width 0.2s ease-in-out;
                  background-color: ${({ theme }) =>
                    theme.surface.sidebarBlack};
                `}
              >
                <LayerView />

                <FilterView />

                <div css="display: flex; padding: 8px; margin-top: auto;">
                  <div
                    css="margin-right: auto; cursor: default;"
                    onClick={sidebarToggle}
                  >
                    <Menu
                      css={`
                        width: 16px;
                      `}
                    />
                  </div>
                </div>
              </Sidebar>
            </div>
          )}
        </>

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
          style={{
            // prettier-ignore
            cursor:
              editorState.currentTool === 'cursor' ? 'default' :
              editorState.currentTool === 'draw' ? 'url(cursors/pencil.svg), auto' :
              editorState.currentTool === 'erase' ? 'url(cursors/eraser.svg), auto' :
              editorState.currentTool === 'shape-pen' ? 'url(cursors/pencil-line.svg), auto':
              'default',
          }}
        >
          {dragState.over && (
            <div
              css={`
                position: absolute;
                top: 0;
                left: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                z-index: 1;
                background-color: rgba(0, 0, 0, 0.5);
              `}
            >
              ドロップして画像を追加
            </div>
          )}
          <div
            css="position: absolute;"
            style={{
              transform: `scale(${scale}) rotate(${rotate}deg) translate(${position.x}px, ${position.y}px)`,
            }}
          >
            <ControlsOverlay scale={scale} />
            <canvas
              css="background-color: white; box-shadow: 0 0 16px rgba(0,0,0,.1)"
              ref={canvasRef}
            />
          </div>
          <div
            css={`
              position: absolute;
              left: 50%;
              bottom: 16px;
              transform: translateX(-50%);
            `}
          >
            <MainActions />
          </div>

          <DebugView
            css={`
              position: absolute;
              top: 0;
              right: 0;
            `}
          />
        </div>

        <>
          {!isNarrowMedia && (
            <Sidebar
              style={{
                width: sidebarOpened ? 200 : 32,
              }}
            >
              <div
                css={`
                  padding: 4px 8px;
                `}
              >
                {t('colorHistory')}
              </div>
              <div
                css={`
                  padding: 4px 8px;
                `}
              >
                {t('referenceColor')}
              </div>
              <div
                css={`
                  padding: 4px 8px;
                `}
              >
                <label>
                  <input
                    css="margin-right: 4px"
                    type="checkbox"
                    checked={editorState.renderSetting.disableAllFilters}
                    onChange={handleChangeDisableFilters}
                  />
                  作業中のフィルター効果をオフ
                </label>
              </div>
            </Sidebar>
          )}
        </>
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

export default function Index() {
  return (
    <LysContext>
      <IndexContent />
    </LysContext>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale!, ['app'], i18nConfig)),
      // Will be passed to the page component as props
    },
  }
}

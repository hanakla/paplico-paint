import { loadImageFromBlob, useAsyncEffect, useFunk } from '@hanakla/arma'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { rgba } from 'polished'
import { MouseEvent, useEffect, useRef, useState } from 'react'
import { Pap4 } from '@paplico/core'

import { Button } from '🙌/components/Button'
import { Stack } from '🙌/components/Stack'
import { DevLayout } from '🙌/layouts/DevLayout'
import { centering, checkerBoard } from '🙌/utils/mixins'
// import { DifferenceRender } from '@paplico/core/dist/engine/RenderStrategy/DifferenceRender'
import { roundString } from '../../utils/StringUtils'

export default function Engine4Dev() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sessionRef = useRef<PapSession | null>(null)
  const benchRef = useRef<{ start: () => void; stop: () => void } | null>(null)
  const controlRef = useRef<{
    rerender: () => void
    rerenderWithoutCache: () => void
    toggleFilters: () => void
  } | null>(null)

  const [strategy, setStrategy] = useState<'difference' | 'full'>('difference')
  const [bgColor, setBGColor] = useState('#fff')
  const [point, setPointedColor] = useState({
    x: -1,
    y: -1,
    r: 0,
    g: 0,
    b: 0,
    a: 0,
  })

  useAsyncEffect(async () => {
    setTimeout(async () => {
      const engine = ((window as any)._engine = new Pap4.Engine4({
        canvas: canvasRef.current!,
      }))
      const session =
        (sessionRef.current =
        (window as any)._session =
          await PapSession.create())

      session.renderStrategy = new RenderStrategies.DifferenceRender()

      session.pencilMode = 'draw'
      session.setBrushSetting({
        brushId: PapBrushes.ScatterBrush.id,
        size: 20,
        color: { r: 0.2, g: 0.2, b: 0.2 },
      })

      new CanvasHandler(canvasRef.current!).connect(
        session,
        session.renderStrategy as any,
        engine
      )

      {
        const strategy = session.renderStrategy

        const document = PapDOM.Document.create({ width: 400, height: 400 })
        const raster = PapDOM.RasterLayer.create({ width: 400, height: 400 })
        const filter = PapDOM.FilterLayer.create({})

        filter.filters.push(
          PapDOM.Filter.create({
            filterId: '@paplico/filters/hue-shift',
            visible: true,
            settings: {
              ...engine.toolRegistry.getFilterInstance(
                '@paplico/filters/hue-shift'
              )!.initialConfig,
              shift: 0.5,
            },
          }),
          ...[]
        )

        document.addLayer(raster)
        document.addLayer(filter)

        session.setDocument(document)
        session.setActiveLayer([raster.uid])

        canvasRef.current!.width = document.width
        canvasRef.current!.height = document.height

        await engine.render(document, strategy)
      }
    }, 800)

    return () => {}
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
  }, [])

  return (
    <DevLayout>
      <Stack
        css={`
          background-color: ${bgColor};
        `}
        dir="horizontal"
      >
        <div onTouchStart={(e) => e.preventDefault()}>
          Canvas <br />
          <canvas
            ref={canvasRef}
            css={`
              /* width: 400px;
              height: 400px; */
              margin: 16px;
              box-shadow: 0 0 4px ${rgba('#000', 0.4)};
              /* background-color: red; */
              /* ${checkerBoard({ size: 8 })} */
              transition: none !important;
            `}
          />
        </div>
      </Stack>
    </DevLayout>
  )
}

const BGColor = ({
  color,
  onClick,
}: {
  color: string
  onClick: (color: string) => void
}) => {
  return (
    <div
      css={`
        width: 24px;
        height: 24px;
        border: 1px solid #000;
      `}
      style={{ backgroundColor: color }}
      onClick={() => {
        onClick(color)
      }}
    />
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    props: {},
    notFound: process.env.NODE_ENV !== 'production' ? false : true,
  }
}

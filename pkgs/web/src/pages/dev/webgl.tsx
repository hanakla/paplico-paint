import { loadImageFromBlob, useAsyncEffect, useFunk } from '@hanakla/arma'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { rgba } from 'polished'
import { MouseEvent, useEffect, useRef, useState } from 'react'
import {
  CanvasHandler,
  RenderStrategies,
  PaplicoEngine,
  PapBrushes,
  PapDOM,
  PapSession,
  PapWebGLContext,
} from '@paplico/core'

import { Button } from '🙌/components/Button'
import { Stack } from '🙌/components/Stack'
import { DevLayout } from '🙌/layouts/DevLayout'
import { centering, checkerBoard } from '🙌/utils/mixins'
import { DifferenceRender } from '@paplico/core/dist/engine/RenderStrategy/DifferenceRender'
import { roundString } from '../../utils/StringUtils'

export default function Debug() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const export2CanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [bgColor, setBGColor] = useState('#fff')
  const [imageUrl, setImageUrl] = useState('')
  const [point, setPointedColor] = useState({
    x: -1,
    y: -1,
    r: 0,
    g: 0,
    b: 0,
    a: 0,
  })

  const handleCanvasMouseMove = useFunk((e: MouseEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget!.getBoundingClientRect()
    const pos = {
      x: Math.floor(e.clientX - box.left),
      y: Math.floor(e.clientY - box.top),
    }
    const ctx = e.currentTarget?.getContext('2d')!
    const pixel = ctx.getImageData(pos.x, pos.y, 1, 1)

    if (!pixel) return

    setPointedColor({
      x: pos.x,
      y: pos.y,
      r: pixel.data[0],
      g: pixel.data[1],
      b: pixel.data[2],
      a: pixel.data[3],
    })
  })

  useAsyncEffect(async () => {
    const ctx = canvasRef.current!.getContext('2d', { alpha: true })!
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    const gl = new PapWebGLContext()
    const prog = gl.createProgram(`
      precision mediump float;

      varying vec2 vUv;
      // uniform sampler2D source;

      void main(void)
      {
        // gl_FragColor = vec4(1., 1., 1., step(.5, texture2D(source, vUv).a) * .6);
        gl_FragColor = vec4(1., 0., 0., step(.5, vUv) * .5);
      }
    `)

    gl.applyProgram(prog, {}, ctx.canvas, ctx.canvas)
    gl.applyProgram(prog, {}, ctx.canvas, ctx.canvas)
    // ctx.drawImage(ctx.canvas, 0, 0)

    const { image, url } = await loadImageFromBlob(
      await new Promise<Blob>((r) =>
        ctx.canvas.toBlob((b) => r(b!), 'image/png')
      )
    )

    setImageUrl(url)
    exportCanvasRef.current!.getContext('2d')!.drawImage(ctx.canvas, 0, 0)
    export2CanvasRef.current!.getContext('2d')!.drawImage(image, 0, 0)

    document.body.appendChild(gl.gl.canvas)

    return () => {}
  }, [])

  return (
    <DevLayout>
      <Stack
        css={`
          padding: 8px;
        `}
        dir="vertical"
      >
        <Stack dir="horizontal" gap={16}>
          <Stack
            css={`
              ${centering()}
            `}
            dir="horizontal"
          >
            背景色
            <BGColor color="#fff" onClick={(color) => setBGColor(color)} />
            <BGColor color="#000" onClick={(color) => setBGColor(color)} />
            <BGColor color="#aaa" onClick={(color) => setBGColor(color)} />
          </Stack>
        </Stack>

        <div>
          <span
            css={`
              ${checkerBoard({ size: 8 })}
            `}
          >
            <span
              css={`
                display: inline-block;
                float: left;
                margin-right: 4px;
                width: 24px;
                height: 24px;
                border: 1px solid #000;
              `}
              style={{
                backgroundColor: rgba(
                  point.r,
                  point.g,
                  point.b,
                  Math.round((point.a / 255) * 10 ** 2) / 10 ** 2
                ),
              }}
            />
          </span>
          Coord: {point.x} {point.y}
          <br />
          R: {roundString(point.r / 255, 2)} ({point.r}) G:{' '}
          {roundString(point.g / 255, 2)} ({point.g}) B:{' '}
          {roundString(point.b / 255, 2)} ({point.b}) A:{' '}
          {roundString(point.a / 255, 2)} ({point.a})
        </div>
      </Stack>

      <Stack
        css={`
          background-color: ${bgColor};
          padding: 8px;
          flex-wrap: wrap;
        `}
        dir="horizontal"
      >
        <div>
          Render
          <br />
          <canvas
            ref={canvasRef}
            css={`
              box-shadow: 0 0 4px ${rgba('#000', 0.4)};
              /* background-color: red; */
              /* ${checkerBoard({ size: 8 })} */
              transition: none !important;
            `}
            onMouseMove={handleCanvasMouseMove}
          />
        </div>
        <div>
          Exported (&lt;img /&gt;)
          <br />
          <img src={imageUrl} />
        </div>

        <div
          css={`
            flex-basis: 100%;
            height: 0;
          `}
        />

        <div>
          drawImage (Canvas to Canvas)
          <br />
          <canvas ref={exportCanvasRef} onMouseMove={handleCanvasMouseMove} />
        </div>

        <div>
          drawImage (PNG to Canvas)
          <br />
          <canvas ref={export2CanvasRef} onMouseMove={handleCanvasMouseMove} />
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

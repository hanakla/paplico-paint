'use client'

import {
  Document,
  ExtraBrushes,
  Paplico,
  StandardBrushes
} from '@paplico/core-new'
import { useRef } from 'react'
import { useEffectOnce } from 'react-use'
import { css } from 'styled-components'
import { theming } from '../utils/styled'
import { checkerBoard } from '../utils/cssMixin'

export default function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffectOnce(() => {
    const pap = (window.pap = new Paplico(canvasRef.current!))
    pap.brushes.register(ExtraBrushes.ScatterBrush)
    pap.uiCanvas.on('strokeComplete', stroke => {
      console.log(stroke)
    })

    const doc = Document.createDocument({ width: 1000, height: 1000 })
    const vector = Document.createRasterLayerEntity({
      width: 1000,
      height: 1000
    })

    doc.layerEntities.push(vector)
    doc.layerTree.push({ layerUid: vector.uid, children: [] })

    pap.loadDocument(doc)

    pap.enterLayer([vector.uid])

    // pap.strok
    pap.strokeSetting = {
      brushId: ExtraBrushes.ScatterBrush.id,
      brushVersion: '0.0.1',
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      size: 10,
      specific: {
        texture: 'pencil',
        noiseInfluence: 1,
        inOutInfluence: 0,
        inOutLength:0,
      } satisfies ExtraBrushes.ScatterBrush.SpecificSetting
    }

    console.log(pap)
  })

  return (
    <div
      css={css`
        width: 100%;
        height: 100%;
        ${theming(o => [o.bg.surface3])}
      `}
    >
      <canvas
        css={css`
          background-color: #fff;
          ${checkerBoard({ size: 10, opacity: 0.1 })};
        `}
        ref={canvasRef}
        width={1000}
        height={1000}
      />
    </div>
  )
}

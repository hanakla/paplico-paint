import { loadImage, useFunk } from '@hanakla/arma'
import Paplico, {
  UICanvas,
  Document,
  ExtraBrushes,
  _installPapDebugGlobaly,
} from '@paplico/core-new'
import { MouseEvent, useEffect, useRef, useState } from 'react'
import { useEffectOnce } from 'react-use'
import { css } from 'styled-components'
import { ColorInput } from '🙌/features/Paint/containers/FilterSettings/_components'
import { timesMap } from '🙌/utils/array'

// const InfiniteCanvas: typeof import('ef-infinite-canvas').InfiniteCanvas = require('ef-infinite-canvas')

export default function NewPage() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const pap = useRef<Paplico | null>(null)
  const [doc, setDoc] = useState<Document.PaplicoDocument | null>(null)
  const [color, setColor] = useState({ r: 0, g: 0, b: 0, a: 1 })

  const onClickLayer = useFunk((e: MouseEvent<HTMLButtonElement>) => {
    const uid = e.currentTarget.dataset.uid!
    pap.current?.enterLayer([uid])
  })

  const onColorChange = useFunk((rgba: any) => {
    setColor(rgba)
    pap.current!.strokeSetting = {
      brushId: ExtraBrushes.ScatterBrush.id,
      brushVersion: '1.0.0',
      color: rgba,
      opacity: 1,
      size: 10,
      specific: {},
    }
  })

  useEffectOnce(() => {
    _installPapDebugGlobaly()

    const paplico = (window.pap = pap.current = new Paplico(ref.current!))
    paplico.brushes.register(ExtraBrushes.ScatterBrush)
    console.log(paplico.brushes)

    // console.log(new ExtraBrushes.ScatterBrush().initialize())

    const doc = (window.__papdoc = new Document.PaplicoDocument())
    doc.layerEntities.push(
      Document.createFilterLayerEntity({
        filters: [],
      }),
      Document.createRasterLayerEntity({
        width: 500,
        height: 500,
      }),
      Document.createVectorLayerEntity({})
    )

    doc.layerTree.push({ layerUid: doc.layerEntities[0].uid, children: [] })
    doc.layerTree.push({ layerUid: doc.layerEntities[1].uid, children: [] })
    doc.layerTree.push({ layerUid: doc.layerEntities[2].uid, children: [] })

    paplico.loadDocument(doc)
    paplico.enterLayer([doc.layerEntities[0].uid])

    paplico.strokeSetting = {
      // brushId: '@paplico/core/circle-brush',
      brushId: '@paplico/core/circle-brush',
      // brushId: ExtraBrushes.ScatterBrush.id,
      brushVersion: '1.0.0',
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      size: 10,
      specific: {},
    }

    setDoc(doc)

    return () => {
      paplico.dispose()
    }
  })

  useEffect(() => {
    document.addEventListener('touchstart', (e) => e.stopPropagation())
    document.addEventListener('touchmove', (e) => e.stopPropagation())
  })

  return (
    <div
      css={css`
        transform-style: preserve-3d;
        perspective: 1000px;
      `}
    >
      <canvas
        css={css`
          margin: 16px;
          /* transform: rotateX(2deg) rotateY(-25deg) rotateZ(10deg); */
          border: 1px solid #ccc;
          touch-action: manipulation;
        `}
        ref={ref}
        width={500}
        height={500}
        onTouchStart={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
      />

      <ColorInput value={color} onChange={onColorChange} />

      <div
        css={css`
          display: grid;
        `}
      >
        {doc &&
          [...doc.layerEntities].reverse().map((l) => (
            <button data-uid={l.uid} onClick={onClickLayer}>
              {l.uid}
            </button>
          ))}
      </div>
    </div>
  )
}

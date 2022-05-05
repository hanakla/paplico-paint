import { PapDOM } from '@paplico/core'

export const createDocumentWithSize = ({
  width,
  height,
}: {
  width: number
  height: number
}) => {
  const doc = PapDOM.Document.create({ width, height })
  const layer = PapDOM.RasterLayer.create({ width, height })
  const bgLayer = PapDOM.VectorLayer.create({})
  bgLayer.objects.push(
    PapDOM.VectorObject.create({
      x: 0,
      y: 0,
      path: PapDOM.Path.create({
        points: [
          { x: 0, y: 0, in: null, out: null },
          { x: width, y: 0, in: null, out: null },
          { x: width, y: height, in: null, out: null },
          { x: 0, y: height, in: null, out: null },
        ],
        closed: true,
      }),
      brush: null,
      fill: {
        type: 'fill',
        color: { r: 1, g: 1, b: 1 },
        opacity: 1,
      },
    })
  )
  doc.addLayer(bgLayer)
  doc.addLayer(layer, { aboveLayerId: bgLayer.uid })
  doc.activeLayerPath = [layer.uid]

  return doc
}

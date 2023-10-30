import { writeFileSync } from 'fs'
import { createCanvas, Image } from 'node-canvas-webgl'
import { Canvas, ImageData, loadImage } from 'canvas'
import {
  Paplico,
  CanvasFactory,
  Document,
  ExtraBrushes,
  Inks,
  Filters,
  Brushes,
} from '@paplico/core-new'

CanvasFactory.setCanvasImpls({
  createImageBitmap: async (image: ImageBitmapSource) => {
    let ab: ArrayBufferLike

    if (image instanceof ImageData) {
      const c = new Canvas(image.width, image.height).getContext('2d')
      c.putImageData(image, 0, 0)
      ab = c.canvas.toBuffer('image/png')

      console.log(ab)
    } else if (image instanceof Canvas) {
      ab = image.toBuffer('image/png')
    }

    const img = await loadImage(Buffer.from(ab))

    return img
  },
  createImageData: (...args: any[]) => new ImageData(...args),
  createImage: () => new Image(),
  createCanvas: () => createCanvas(1, 1),
  CanvasClass: Canvas,
})
//
;(async () => {
  const canvas = createCanvas(1000, 1000)
  const pap = new Paplico(canvas)

  // await pap.brushes.register(Brushes.CircleBrush)

  const doc = Document.createDocument({ width: 1000, height: 1000 })
  const raster = Document.createRasterLayerEntity({
    width: 1000,
    height: 1000,
  })

  const vector = Document.createVectorLayerEntity({
    filters: [
      Document.createFilterEntry({
        enabled: false,
        opacity: 1,
        filterId: Filters.TestFilter.metadata.id,
        filterVersion: Filters.TestFilter.metadata.version,
        settings: Filters.TestFilter.getInitialConfig(),
      }),
    ],
  })

  const text = Document.createTextLayerEntity({
    transform: {
      position: { x: 16, y: 16 },
      scale: { x: 1, y: 1 },
      rotate: 0,
    },
    fontFamily: 'Poppins',
    fontStyle: 'Bold',
    fontSize: 64,
  })
  text.textNodes.push(
    { text: 'PAPLIC-o-\n', position: { x: 0, y: 0 } },
    {
      text: 'MAGIC',
      fontSize: 128,
      position: { x: 0, y: 0 },
    },
  )

  vector.objects.push(
    Document.createVectorObject({
      path: Document.createVectorPath({
        points: [
          { isMoveTo: true, x: 0, y: 0 },
          { x: 1000, y: 1000, begin: null, end: null },
        ],
      }),
      filters: [
        Document.createVectorAppearance({
          kind: 'stroke',
          stroke: {
            brushId: Brushes.CircleBrush.metadata.id,
            brushVersion: '0.0.1',
            color: { r: 1, g: 1, b: 0 },
            opacity: 1,
            size: 30,
            specific: {
              texture: 'pencil',
              noiseInfluence: 1,
              inOutInfluence: 0,
              inOutLength: 0,
            } satisfies Brushes.CircleBrush.Settings,
          },
          ink: {
            inkId: Inks.TextureReadInk.id,
            inkVersion: Inks.TextureReadInk.version,
            specific: {} satisfies Inks.TextureReadInk.SpecificSetting,
          },
        }),
      ],
    }),
  )

  doc.addLayer(
    Document.createVectorLayerEntity({
      objects: [
        Document.createVectorObject({
          path: Document.createVectorPath({
            points: [
              { isMoveTo: true, x: 0, y: 0 },
              { x: 1000, y: 0, begin: null, end: null },
              { x: 1000, y: 1000, begin: null, end: null },
              { x: 0, y: 1000, begin: null, end: null },
              { isClose: true, x: 0, y: 0 },
            ],
            closed: true,
          }),
          filters: [
            // Document.createVectorAppearance({
            //   kind: 'fill',
            //   fill: {
            //     type: 'fill',
            //     color: { r: 0, g: 0, b: 1 },
            //     opacity: 1,
            //   },
            // }),
          ],
        }),
      ],
    }),
  )
  doc.addLayer(raster, [])
  doc.addLayer(vector, [])
  doc.addLayer(Document.createVectorLayerEntity({}), [])
  doc.addLayer(text, [])

  pap.loadDocument(doc)
  // pap.setStrokingTargetLayer([raster.uid])
  pap.setStrokingTargetLayer([vector.uid])
  await pap.rerender()

  console.log('hi')

  await pap.exporters.png({}).then(async (blob) => {
    writeFileSync('test.png', new Uint8Array(await blob.arrayBuffer()))
  })

  process.on('uncaughtException', (e) => {
    console.error(e)
  })
})()

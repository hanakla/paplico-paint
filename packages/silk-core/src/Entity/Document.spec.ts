import { Document } from './Document'
import { writeFileSync } from 'fs'
import { RasterLayer } from './RasterLayer'

describe('Document', () => {
  describe('toBlob', () => {
    it('', async () => {
      try {
        const document = new Document()
        document.width = 100
        document.height = 100

        const layer = RasterLayer.create({ width: 100, height: 100 })
        // document.addLayer(layer)

        // const ab = document.toArrayBuffer()
        // console.log(ab)
        // writeFileSync('./test.silk', ab as any)
      } catch (e) {
        console.error(e)
      }
    })
  })
})

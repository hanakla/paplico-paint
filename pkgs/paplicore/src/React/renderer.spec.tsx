import * as PapDOM from '../DOM/index'

import { Document } from './components/Document'
import { LayerList } from './components/LayerList'
import { RasterLayer } from './components/RasterLayer'
import { VectorLayer } from './components/VectorLayer'
import { PaplicoRenderer } from './renderer'

describe('React', () => {
  it('', () => {
    const document = new PapDOM.Document()
    document.layers = [
      PapDOM.RasterLayer.create({ width: 100, height: 100 }),
      PapDOM.VectorLayer.create({}),
    ]

    PaplicoRenderer.render(
      <Document {...document}>
        <LayerList>
          {document.layers.map((l) =>
            l.layerType === 'raster' ? (
              <RasterLayer {...l} />
            ) : l.layerType === 'vector' ? (
              <VectorLayer {...l} />
            ) : null
          )}
        </LayerList>
      </Document>,
      {}
    )
  })
})

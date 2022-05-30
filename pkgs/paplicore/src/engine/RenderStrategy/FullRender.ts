import { Document, LayerTypes } from '../../DOM'
import { PaplicoEngine } from '../Engine3'
import { DifferenceRender } from './DifferenceRender'

export class FullRender extends DifferenceRender {
  public get renderScale() {
    return 1
  }

  public async render(
    engine: PaplicoEngine,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    super.clearCache()
    await super.render(engine, document, destCtx)
  }
}

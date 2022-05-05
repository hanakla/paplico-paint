import { Document } from '../DOM'
import { PaplicoEngine } from '../engine/Engine3'
import { FullRender } from '../engine/RenderStrategy/FullRender'
import { createContext2D } from '../Engine3_CanvasFactory'
import { workerSafeCanvasToBlob } from '../PapHelpers'
import { setCanvasSize } from '../utils'

export class CombinedImage {
  private strategy = new FullRender()

  public async export(
    engine: PaplicoEngine,
    document: Document,
    type: string,
    quality?: number
  ): Promise<Blob> {
    const ctx = createContext2D()
    setCanvasSize(ctx.canvas, document)
    await engine.render(document, this.strategy, { target: ctx })

    const blob = await workerSafeCanvasToBlob(ctx.canvas, { type, quality })
    // Free memory for canvas
    setCanvasSize(ctx.canvas, 0, 0)
    return blob
  }
}

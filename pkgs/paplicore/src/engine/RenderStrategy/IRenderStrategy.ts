import { type PaplicoEngine } from '../../engine/Engine3'
import { type Document } from '../../DOM'

export interface IRenderStrategy {
  renderScale: number

  dispose(): void

  render(
    engine: PaplicoEngine,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void>
}

import { type SilkEngine3 } from '../../engine/Engine3'
import { type Document } from '../../SilkDOM'

export interface IRenderStrategy {
  renderScale: number

  dispose(): void

  render(
    engine: SilkEngine3,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void>
}

import { SilkEngine3 } from 'engine/Engine3'
import { Document } from '../../SilkDOM'

export interface IRenderStrategy {
  renderScale: number

  render(
    engine: SilkEngine3,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void>
}

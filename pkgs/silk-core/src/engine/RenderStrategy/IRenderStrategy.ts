import { SilkEngine3 } from 'engine/Engine3'
import { Document } from '../../Entity'

export interface IRenderStrategy {
  render(
    engine: SilkEngine3,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void>
}
